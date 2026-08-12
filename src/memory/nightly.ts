import type { Session } from 'agents/experimental/memory/session';

import {
  buildExtractionRetryMessageList,
  buildMemoryExtractionMessageList,
  flattenRecentHistoryToTranscript,
  mergeOwnerFacts,
  OWNER_MEMORY_MIN_RUN_INTERVAL_MS,
  OWNER_MEMORY_TRANSCRIPT_BYTE_BUDGET,
  parseMemoryExtractionResult,
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
import { enqueueMemoryIndexJob } from '@/queues/consume';
import { chatWithOpenRouter } from '@/voice/llm';

export const OWNER_MEMORY_STATE_PREFERENCE_KEY = 'ownerMemoryState';

export type OwnerMemoryConsolidationDependencies = {
  readonly sqlExecutor: MemorySqlExecutor;
  readonly session: Session;
  readonly environment: Env;
  readonly deviceId: string;
  readonly nowMilliseconds: number;
  readonly createIdentifier: () => string;
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
  if (
    state !== undefined &&
    nowMilliseconds - state.lastConsolidatedAtMilliseconds <
      OWNER_MEMORY_MIN_RUN_INTERVAL_MS
  ) {
    return;
  }
  const latestLeaf = await session.getLatestLeaf();
  if (latestLeaf === null || latestLeaf.id === state?.lastProcessedLeafId) {
    // An idle day: nothing new happened, so the run costs zero LLM calls.
    const idleState: OwnerMemoryState = {
      factList: state?.factList ?? [],
      lastConsolidatedAtMilliseconds: nowMilliseconds,
      ...(state?.lastProcessedLeafId !== undefined
        ? { lastProcessedLeafId: state.lastProcessedLeafId }
        : {}),
    };
    await setSessionPreference(
      sqlExecutor,
      OWNER_MEMORY_STATE_PREFERENCE_KEY,
      JSON.stringify(idleState),
    );
    return;
  }
  const recentHistory = await session.getRecentHistory(
    OWNER_MEMORY_TRANSCRIPT_BYTE_BUDGET,
  );
  const seededFactList = seedOwnerFactsFromMemoryBlock({
    blockContent: session.getContextBlock('memory')?.content ?? '',
    knownFactList: state?.factList ?? [],
    nowMilliseconds,
    createIdentifier: dependencies.createIdentifier,
  });
  const extractionMessageList = buildMemoryExtractionMessageList({
    transcriptText: flattenRecentHistoryToTranscript(recentHistory.messages),
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
  // the insert idempotent, and the index job is enqueued even for an existing
  // row — Vectorize upserts by memory id, so a run that died between insert
  // and enqueue heals here instead of leaving the row unsearchable forever.
  for (const genuinelyNewFact of merge.genuinelyNewFactList) {
    const existingMemoryId = await findMemoryRecordIdByContent(
      sqlExecutor,
      genuinelyNewFact.content,
    );
    const memoryId =
      existingMemoryId ??
      (await addMemoryRecord(sqlExecutor, genuinelyNewFact.content)).id;
    await enqueueMemoryIndexJob(dependencies.environment, {
      memoryId,
      content: genuinelyNewFact.content,
      deviceId: dependencies.deviceId,
    });
  }
  // The checkpoint is written only after every durable output above succeeded:
  // a failure mid-run leaves lastProcessedLeafId untouched, so the next night
  // reprocesses the same window (the content dedupe makes that idempotent)
  // instead of silently skipping it.
  const nextState: OwnerMemoryState = {
    factList: merge.nextFactList,
    lastConsolidatedAtMilliseconds: nowMilliseconds,
    lastProcessedLeafId: latestLeaf.id,
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
      transcriptTruncated: recentHistory.truncated,
    }),
  );
}
