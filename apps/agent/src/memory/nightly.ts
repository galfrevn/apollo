import type { Session } from 'agents/experimental/memory/session';

import {
  buildExtractionRetryMessageList,
  buildMemoryExtractionMessageList,
  mergeOwnerFacts,
  OWNER_MEMORY_MIN_RUN_INTERVAL_MS,
  OWNER_MEMORY_TRANSCRIPT_BYTE_BUDGET,
  parseMemoryExtractionResult,
  parseStoredMemoryIndexIntentList,
  parseStoredOwnerMemoryState,
  renderOwnerMemoryBlock,
  seedOwnerFactsFromMemoryBlock,
  type OwnerMemoryState,
} from '@/memory/consolidate';
import {
  addMemoryRecord,
  findMemoryRecordIdByContent,
  getSessionPreference,
  setSessionPreference,
  type MemorySqlExecutor,
} from '@/memory/store';
import type { JobPublisher } from '@/platform/jobs';
import { enqueueMemoryIndexJob } from '@/queues/consume';
import { chatWithOpenRouter } from '@/voice/llm';

export const OWNER_MEMORY_STATE_PREFERENCE_KEY = 'ownerMemoryState';
export const OWNER_MEMORY_INDEX_INTENT_PREFERENCE_KEY = 'ownerMemoryIndexIntents';

// The intent list is a write-ahead log for the persist+index pair: an entry
// is durable before the row insert, so a crash at any point replays here —
// inserting the row if it never landed, then re-enqueueing its index job
// (an upsert by id, so replays are idempotent).
async function drainMemoryIndexIntents(
  dependencies: OwnerMemoryConsolidationDependencies,
): Promise<void> {
  const storedIntentList = await getSessionPreference(
    dependencies.sqlExecutor,
    OWNER_MEMORY_INDEX_INTENT_PREFERENCE_KEY,
  );
  const intentList =
    storedIntentList === null
      ? undefined
      : parseStoredMemoryIndexIntentList(storedIntentList);
  if (intentList === undefined || intentList.length === 0) {
    return;
  }
  for (const intent of intentList) {
    const existingMemoryId = await findMemoryRecordIdByContent(
      dependencies.sqlExecutor,
      intent.content,
    );
    if (existingMemoryId === undefined) {
      await addMemoryRecord(
        dependencies.sqlExecutor,
        intent.content,
        dependencies.nowMilliseconds,
        () => intent.memoryId,
      );
    }
    await enqueueMemoryIndexJob(dependencies.jobPublisher, {
      memoryId: existingMemoryId ?? intent.memoryId,
      content: intent.content,
      deviceId: dependencies.deviceId,
    });
  }
  await setSessionPreference(
    dependencies.sqlExecutor,
    OWNER_MEMORY_INDEX_INTENT_PREFERENCE_KEY,
    '[]',
  );
}

export type OwnerMemoryConsolidationDependencies = {
  readonly sqlExecutor: MemorySqlExecutor;
  readonly session: Session;
  readonly environment: Env;
  readonly jobPublisher: JobPublisher;
  readonly deviceId: string;
  readonly nowMilliseconds: number;
  readonly createIdentifier: () => string;
  readonly gatherTranscriptSince: (
    sinceMilliseconds: number,
    transcriptByteBudget: number,
  ) => Promise<{
    readonly transcriptText: string;
    readonly hasNewActivity: boolean;
  }>;
};

// Roadmap item 18: the nightly cron owns the previously append-only memory
// context block — it reads the recent transcript, asks the LLM to extract,
// reinforce, and retire owner facts, and rewrites the block consolidated.
export async function runOwnerMemoryConsolidation(
  dependencies: OwnerMemoryConsolidationDependencies,
): Promise<void> {
  const { sqlExecutor, session, nowMilliseconds } = dependencies;
  const storedState = await getSessionPreference(
    sqlExecutor,
    OWNER_MEMORY_STATE_PREFERENCE_KEY,
  );
  const state =
    storedState === null ? undefined : parseStoredOwnerMemoryState(storedState);
  await drainMemoryIndexIntents(dependencies);
  if (
    state !== undefined &&
    nowMilliseconds - state.lastConsolidatedAtMilliseconds <
      OWNER_MEMORY_MIN_RUN_INTERVAL_MS
  ) {
    return;
  }
  // Turns spread across every thread that was active since the last run, so
  // the transcript is gathered thread by thread instead of from one session.
  const gatheredTranscript = await dependencies.gatherTranscriptSince(
    state?.lastConsolidatedAtMilliseconds ?? 0,
    OWNER_MEMORY_TRANSCRIPT_BYTE_BUDGET,
  );
  if (!gatheredTranscript.hasNewActivity) {
    // An idle day: nothing new happened, so the run costs zero LLM calls.
    const idleState: OwnerMemoryState = {
      factList: state?.factList ?? [],
      lastConsolidatedAtMilliseconds: nowMilliseconds,
    };
    await setSessionPreference(
      sqlExecutor,
      OWNER_MEMORY_STATE_PREFERENCE_KEY,
      JSON.stringify(idleState),
    );
    return;
  }
  const seededFactList = seedOwnerFactsFromMemoryBlock({
    blockContent: session.getContextBlock('memory')?.content ?? '',
    knownFactList: state?.factList ?? [],
    nowMilliseconds,
    createIdentifier: dependencies.createIdentifier,
  });
  const extractionMessageList = buildMemoryExtractionMessageList({
    transcriptText: gatheredTranscript.transcriptText,
    existingFactList: seededFactList,
    nowIso: new Date(nowMilliseconds).toISOString(),
  });
  const firstChatResult = await chatWithOpenRouter({
    openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
    modelId: dependencies.environment.OPENROUTER_MODEL,
    messageList: extractionMessageList,
  });
  let extraction = parseMemoryExtractionResult(firstChatResult.text);
  if (extraction === undefined) {
    const retryChatResult = await chatWithOpenRouter({
      openRouterApiKey: dependencies.environment.OPENROUTER_API_KEY,
      modelId: dependencies.environment.OPENROUTER_MODEL,
      messageList: buildExtractionRetryMessageList(
        extractionMessageList,
        firstChatResult.text,
      ),
    });
    extraction = parseMemoryExtractionResult(retryChatResult.text);
  }
  if (extraction === undefined) {
    // State stays untouched so the next night retries over the same window.
    console.error(
      JSON.stringify({ level: 'error', message: 'owner_memory_extraction_invalid' }),
    );
    return;
  }
  const merge = mergeOwnerFacts({
    existingFactList: seededFactList,
    extraction,
    nowMilliseconds,
    createIdentifier: dependencies.createIdentifier,
  });
  await session.replaceContextBlock('memory', renderOwnerMemoryBlock(merge.nextFactList));
  await session.refreshSystemPrompt();
  // Decayed facts stay in the memories table and Vectorize on purpose: that
  // layer is the provenance log recall_memory searches, while the consolidated
  // block only governs what occupies prompt budget. The existence check makes
  // the insert idempotent; already-present rows are skipped outright because
  // any enqueue they might have missed was healed by the intent drain above.
  for (const genuinelyNewFact of merge.genuinelyNewFactList) {
    const existingMemoryId = await findMemoryRecordIdByContent(
      sqlExecutor,
      genuinelyNewFact.content,
    );
    if (existingMemoryId !== undefined) {
      continue;
    }
    // Write-ahead ordering: the intent (with a pre-generated id) is durable
    // before the insert, the insert before the enqueue, and the intent is
    // cleared only once the enqueue succeeded. A crash in any window replays
    // through the drain above — the fact is never persisted without its index
    // job, and never re-enqueued once the pair completed.
    const memoryId = dependencies.createIdentifier();
    await setSessionPreference(
      sqlExecutor,
      OWNER_MEMORY_INDEX_INTENT_PREFERENCE_KEY,
      JSON.stringify([{ memoryId, content: genuinelyNewFact.content }]),
    );
    await addMemoryRecord(
      sqlExecutor,
      genuinelyNewFact.content,
      nowMilliseconds,
      () => memoryId,
    );
    await enqueueMemoryIndexJob(dependencies.jobPublisher, {
      memoryId,
      content: genuinelyNewFact.content,
      deviceId: dependencies.deviceId,
    });
    await setSessionPreference(
      sqlExecutor,
      OWNER_MEMORY_INDEX_INTENT_PREFERENCE_KEY,
      '[]',
    );
  }
  // The checkpoint is written only after every durable output above succeeded:
  // a failure mid-run leaves lastConsolidatedAtMilliseconds untouched, so the
  // next night reprocesses the same window (the content dedupe makes that
  // idempotent) instead of silently skipping it.
  const nextState: OwnerMemoryState = {
    factList: merge.nextFactList,
    lastConsolidatedAtMilliseconds: nowMilliseconds,
  };
  await setSessionPreference(
    sqlExecutor,
    OWNER_MEMORY_STATE_PREFERENCE_KEY,
    JSON.stringify(nextState),
  );
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'owner_memory_consolidated',
      factCount: merge.nextFactList.length,
      newFactCount: merge.genuinelyNewFactList.length,
    }),
  );
}
