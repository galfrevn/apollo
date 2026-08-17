import type { SessionManager } from 'agents/experimental/memory/session';

import { flattenRecentHistoryToTranscript } from '@/memory/consolidate';
import { getSessionPreference, setSessionPreference } from '@/memory/store';
import type { MemorySqlExecutor } from '@/memory/store';
import { embedTextWithOpenRouter, queryMemoryVectors } from '@/memory/vector';
import type { HostScheduler } from '@/platform/bun/scheduler';
import type { JobPublisher } from '@/platform/jobs';
import type { VectorStore } from '@/platform/vector';
import { enqueueMemoryIndexJob } from '@/queues/consume';
import {
  buildThreadDigestMessageList,
  finalizeThreadPayloadSchema,
  parseThreadDigestResult,
  runThreadFinalization,
  THREAD_FINALIZATION_TRANSCRIPT_BYTE_BUDGET,
} from '@/threads/finalize';
import { buildThreadHandoffNote, THREAD_HANDOFF_BYTE_BUDGET } from '@/threads/handoff';
import {
  ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY,
  ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
  buildDefaultThreadTitle,
  COMMAND_THREAD_RETENTION_DAYS,
  decideThreadRotation,
  parseStoredLastTurnAt,
  PREVIOUS_THREAD_SESSION_PREFERENCE_KEY,
  THREAD_INACTIVITY_CUTOFF_MILLISECONDS,
} from '@/threads/lifecycle';
import {
  mapVectorMemoryIdToThreadSessionId,
  selectThreadForResume,
  THREAD_VECTOR_MEMORY_ID_PREFIX,
} from '@/threads/resume';
import {
  deleteThreadMeta,
  getThreadMeta,
  listExpiredCommandThreadSessionIds,
  listThreadMeta,
  listThreadSessionIdsActiveSince,
  markThreadFinalized,
  recordThreadActivity,
  reopenThreadMeta,
} from '@/threads/store';
import { chatWithOpenRouter } from '@/voice/llm';

export type HostThreadEngineDependencies = {
  readonly deviceName: string;
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly sessionManager: SessionManager;
  readonly scheduler: HostScheduler;
  readonly vectorStore: VectorStore;
  readonly jobPublisher: JobPublisher;
  readonly getActiveThreadSessionId: () => string | undefined;
  readonly setActiveThreadSessionId: (sessionId: string | undefined) => void;
};

export function createHostThreadEngine(dependencies: HostThreadEngineDependencies) {
  const { sqlExecutor, sessionManager, scheduler, environment } = dependencies;
  let idleThreadCheckScheduleId: string | undefined;

  async function scheduleIdleThreadCheck(): Promise<void> {
    if (idleThreadCheckScheduleId !== undefined) {
      await scheduler.cancelSchedule(idleThreadCheckScheduleId);
    }
    const idleCheckDelaySeconds =
      Math.ceil(THREAD_INACTIVITY_CUTOFF_MILLISECONDS / 1000) + 60;
    const idleCheckSchedule = await scheduler.schedule(
      idleCheckDelaySeconds,
      'maybeFinalizeIdleThread',
      {},
    );
    idleThreadCheckScheduleId = idleCheckSchedule.id;
  }

  async function writeThreadHandoffNote(
    sourceSessionId: string,
    targetSessionId: string,
  ): Promise<void> {
    const sourceHistory = await sessionManager
      .getSession(sourceSessionId)
      .getRecentHistory(THREAD_HANDOFF_BYTE_BUDGET, 2);
    const handoffNote = buildThreadHandoffNote({
      previousThreadTitle: sessionManager.get(sourceSessionId)?.name ?? '',
      messageList: sourceHistory.messages,
    });
    if (handoffNote === undefined) {
      return;
    }
    const targetSession = sessionManager.getSession(targetSessionId);
    await targetSession.replaceContextBlock('handoff', handoffNote);
    await targetSession.refreshSystemPrompt();
  }

  async function findThreadByVector(query: string): Promise<string | undefined> {
    // Mock mode has no embeddings; the keyword fallback still works.
    if (environment.MOCK_VOICE === '1') {
      return undefined;
    }
    try {
      const values = await embedTextWithOpenRouter({
        openRouterApiKey: environment.OPENROUTER_API_KEY,
        modelId: environment.OPENROUTER_EMBEDDING_MODEL,
        text: query,
      });
      const matchList = await queryMemoryVectors({
        vectorStore: dependencies.vectorStore,
        values,
        deviceId: dependencies.deviceName,
        topK: 8,
      });
      for (const match of matchList) {
        const sessionId = mapVectorMemoryIdToThreadSessionId(match.id);
        if (
          sessionId !== undefined &&
          sessionId !== dependencies.getActiveThreadSessionId() &&
          sessionManager.get(sessionId) !== null
        ) {
          return sessionId;
        }
      }
    } catch {
      // Resume must never fail the turn; the keyword fallback runs next.
    }
    return undefined;
  }

  function findThreadByKeyword(query: string): string | undefined {
    const metaBySessionId = new Map(
      listThreadMeta(sqlExecutor).map((meta) => [meta.sessionId, meta]),
    );
    const candidateList = sessionManager
      .list()
      .filter((sessionInfo) => sessionInfo.id !== dependencies.getActiveThreadSessionId())
      .map((sessionInfo) => ({
        sessionId: sessionInfo.id,
        title: sessionInfo.name,
        summary: metaBySessionId.get(sessionInfo.id)?.summary ?? null,
        lastTurnAtMilliseconds:
          metaBySessionId.get(sessionInfo.id)?.lastTurnAtMilliseconds ?? 0,
      }))
      .toSorted(
        (left, right) => right.lastTurnAtMilliseconds - left.lastTurnAtMilliseconds,
      );
    return selectThreadForResume(candidateList, query)?.sessionId;
  }

  async function finalizeThread(rawPayload: unknown): Promise<void> {
    const payload = finalizeThreadPayloadSchema.parse(rawPayload);
    // A resumed thread is active again by the time a delayed finalizer
    // fires; digesting it now would freeze the old transcript and pin it,
    // because later closes skip non-pending meta.
    const activeThreadSessionId =
      dependencies.getActiveThreadSessionId() ??
      (await getSessionPreference(sqlExecutor, ACTIVE_THREAD_SESSION_PREFERENCE_KEY));
    if (payload.sessionId === activeThreadSessionId) {
      return;
    }
    const existingMeta = getThreadMeta(sqlExecutor, payload.sessionId);
    if (existingMeta !== undefined && existingMeta.kind !== 'pending') {
      return;
    }
    await runThreadFinalization({
      getThreadMessages: async () => {
        const recentHistory = await sessionManager
          .getSession(payload.sessionId)
          .getRecentHistory(THREAD_FINALIZATION_TRANSCRIPT_BYTE_BUDGET, 10);
        return recentHistory.messages;
      },
      generateThreadDigest: async (transcriptText) => {
        // Mock mode has no LLM to call; a dev session must not burn tokens.
        if (environment.MOCK_VOICE === '1' || transcriptText.length === 0) {
          return undefined;
        }
        const chatResult = await chatWithOpenRouter({
          openRouterApiKey: environment.OPENROUTER_API_KEY,
          modelId: environment.OPENROUTER_MODEL,
          messageList: buildThreadDigestMessageList(transcriptText),
        });
        return parseThreadDigestResult(chatResult.text);
      },
      renameThread: async (title) => {
        sessionManager.rename(payload.sessionId, title);
      },
      persistOutcome: async (outcome) => {
        markThreadFinalized(sqlExecutor, {
          sessionId: payload.sessionId,
          kind: outcome.kind,
          summary: outcome.summary,
        });
        if (outcome.kind === 'conversation' && outcome.summary !== null) {
          await enqueueMemoryIndexJob(dependencies.jobPublisher, {
            memoryId: `${THREAD_VECTOR_MEMORY_ID_PREFIX}${payload.sessionId}`,
            content:
              outcome.title !== null
                ? `${outcome.title}: ${outcome.summary}`
                : outcome.summary,
            deviceId: dependencies.deviceName,
          });
        }
      },
    });
  }

  return {
    finalizeThread,
    async rotateForTurn(): Promise<void> {
      const nowMilliseconds = Date.now();
      const storedLastTurnAt = await getSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY,
      );
      const rotationDecision = decideThreadRotation({
        activeSessionId: dependencies.getActiveThreadSessionId() ?? null,
        lastTurnAtMilliseconds: parseStoredLastTurnAt(storedLastTurnAt),
        nowMilliseconds,
      });
      let activeThreadSessionId: string;
      if (rotationDecision.action === 'start') {
        // A thread the idle check already closed still hands its tail to the
        // next thread; its id survives in the previous-thread preference.
        const storedPreviousThreadSessionId = await getSessionPreference(
          sqlExecutor,
          PREVIOUS_THREAD_SESSION_PREFERENCE_KEY,
        );
        const handoffSourceSessionId =
          rotationDecision.previousSessionId ??
          (storedPreviousThreadSessionId !== null &&
          storedPreviousThreadSessionId.length > 0
            ? storedPreviousThreadSessionId
            : null);
        const threadInfo = sessionManager.create(
          buildDefaultThreadTitle(nowMilliseconds),
          { source: 'voice' },
        );
        activeThreadSessionId = threadInfo.id;
        dependencies.setActiveThreadSessionId(threadInfo.id);
        await setSessionPreference(
          sqlExecutor,
          ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
          threadInfo.id,
        );
        await setSessionPreference(
          sqlExecutor,
          PREVIOUS_THREAD_SESSION_PREFERENCE_KEY,
          '',
        );
        if (handoffSourceSessionId !== null) {
          await writeThreadHandoffNote(handoffSourceSessionId, threadInfo.id);
        }
        if (rotationDecision.previousSessionId !== null) {
          await scheduler.schedule(1, 'finalizeThread', {
            sessionId: rotationDecision.previousSessionId,
          });
        }
      } else {
        activeThreadSessionId = rotationDecision.sessionId;
      }
      await setSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY,
        String(nowMilliseconds),
      );
      recordThreadActivity(sqlExecutor, activeThreadSessionId, nowMilliseconds);
      await scheduleIdleThreadCheck();
    },

    async maybeFinalizeIdleThread(): Promise<void> {
      const activeThreadSessionId = dependencies.getActiveThreadSessionId();
      if (activeThreadSessionId === undefined) {
        return;
      }
      const lastTurnAtMilliseconds = parseStoredLastTurnAt(
        await getSessionPreference(sqlExecutor, ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY),
      );
      if (
        lastTurnAtMilliseconds === null ||
        Date.now() - lastTurnAtMilliseconds < THREAD_INACTIVITY_CUTOFF_MILLISECONDS
      ) {
        return;
      }
      dependencies.setActiveThreadSessionId(undefined);
      await setSessionPreference(sqlExecutor, ACTIVE_THREAD_SESSION_PREFERENCE_KEY, '');
      await setSessionPreference(
        sqlExecutor,
        PREVIOUS_THREAD_SESSION_PREFERENCE_KEY,
        activeThreadSessionId,
      );
      await finalizeThread({ sessionId: activeThreadSessionId });
    },

    // Reopening makes the found thread active again: its recency window feeds
    // the next turn, and its meta drops back to pending so the next close
    // regenerates a digest that covers the new turns.
    async resumeConversationThread(
      query: string,
    ): Promise<{ readonly title: string; readonly summary: string | null } | undefined> {
      const resolvedSessionId =
        (await findThreadByVector(query)) ?? findThreadByKeyword(query);
      if (resolvedSessionId === undefined) {
        return undefined;
      }
      const threadInfo = sessionManager.get(resolvedSessionId);
      if (threadInfo === null) {
        return undefined;
      }
      const threadMeta = getThreadMeta(sqlExecutor, resolvedSessionId);
      const nowMilliseconds = Date.now();
      dependencies.setActiveThreadSessionId(resolvedSessionId);
      await setSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
        resolvedSessionId,
      );
      await setSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY,
        String(nowMilliseconds),
      );
      await setSessionPreference(sqlExecutor, PREVIOUS_THREAD_SESSION_PREFERENCE_KEY, '');
      recordThreadActivity(sqlExecutor, resolvedSessionId, nowMilliseconds);
      reopenThreadMeta(sqlExecutor, resolvedSessionId);
      await scheduleIdleThreadCheck();
      return { title: threadInfo.name, summary: threadMeta?.summary ?? null };
    },

    async purgeExpiredCommandThreads(): Promise<void> {
      const retentionCutoffMilliseconds =
        Date.now() - COMMAND_THREAD_RETENTION_DAYS * 86_400_000;
      const expiredSessionIdList = listExpiredCommandThreadSessionIds(
        sqlExecutor,
        retentionCutoffMilliseconds,
      );
      for (const expiredSessionId of expiredSessionIdList) {
        if (expiredSessionId === dependencies.getActiveThreadSessionId()) {
          continue;
        }
        await sessionManager.delete(expiredSessionId);
        deleteThreadMeta(sqlExecutor, expiredSessionId);
      }
      if (expiredSessionIdList.length > 0) {
        console.log(
          JSON.stringify({
            level: 'info',
            message: 'command_threads_purged',
            purgedCount: expiredSessionIdList.length,
          }),
        );
      }
    },

    async gatherThreadTranscriptSince(
      sinceMilliseconds: number,
      transcriptByteBudget: number,
    ): Promise<{ readonly transcriptText: string; readonly hasNewActivity: boolean }> {
      const activeThreadSessionIdList = listThreadSessionIdsActiveSince(
        sqlExecutor,
        sinceMilliseconds,
      );
      if (activeThreadSessionIdList.length === 0) {
        return { transcriptText: '', hasNewActivity: false };
      }
      const transcriptPartList: string[] = [];
      let remainingByteBudget = transcriptByteBudget;
      for (const threadSessionId of activeThreadSessionIdList) {
        if (remainingByteBudget <= 0) {
          break;
        }
        const recentHistory = await sessionManager
          .getSession(threadSessionId)
          .getRecentHistory(remainingByteBudget, 1);
        const transcriptText = flattenRecentHistoryToTranscript(recentHistory.messages);
        if (transcriptText.length === 0) {
          continue;
        }
        transcriptPartList.push(transcriptText);
        remainingByteBudget -= transcriptText.length;
      }
      return {
        transcriptText: transcriptPartList.join('\n\n'),
        hasNewActivity: true,
      };
    },
  };
}

export type HostThreadEngine = ReturnType<typeof createHostThreadEngine>;
