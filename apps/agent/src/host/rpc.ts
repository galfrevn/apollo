import { z } from 'zod';

import type { ApolloHostActor } from '@/host/actor';
import { isDeviceSharedSecretValid } from '@/auth/token';
import { deliverBroadcastText } from '@/broadcast/deliver';
import { buildConsoleStatusSnapshot } from '@/console/status';
import {
  mapSessionMessagesToConsoleHistory,
  mapThreadCatalogToConsoleThreadList,
} from '@/console/history';
import { listConsoleJobDocuments, readConsoleJobDocument } from '@/console/jobs';
import {
  browseConsoleMemory as browseConsoleMemoryRecords,
  deleteConsoleMemory as deleteConsoleMemoryRecord,
} from '@/console/memory';
import {
  consoleAddListItemInputSchema,
  consoleAddMemoryInputSchema,
  consoleBroadcastTextInputSchema,
  consoleCancelReminderInputSchema,
  consoleCreateReminderInputSchema,
  consoleDeleteMemoryInputSchema,
  consoleDocumentInputSchema,
  consoleMemoryBrowseInputSchema,
  consoleRemoveListItemInputSchema,
  consoleSecretInputSchema,
  consoleSpeechModeInputSchema,
  consoleThreadInputSchema,
  consoleThreadListInputSchema,
  consoleWeatherInputSchema,
} from '@/console/rpc';
import { APOLLO_TTS_VOICE } from '@/configuration/identity';
import { LEGACY_THREAD_SESSION_ID, rememberFactInSession } from '@/memory/session';
import { addMemoryRecord, setSessionPreference } from '@/memory/store';
import type { MemorySqlExecutor } from '@/memory/store';
import {
  addListItemRecord,
  listListItemRecords,
  removeListItemRecordById,
} from '@/lists/store';
import type { BlobStore } from '@/platform/blob';
import type { JobPublisher } from '@/platform/jobs';
import type { VectorStore } from '@/platform/vector';
import { resolveDeskSpeechMode } from '@/persona/catalog';
import { enqueueMemoryIndexJob } from '@/queues/consume';
import { listThreadMeta } from '@/threads/store';
import { geocodeDeskWeatherLocation } from '@/weather/geocode';
import {
  serializeWeatherLocation,
  WEATHER_LOCATION_PREFERENCE_KEY,
} from '@/weather/location';
import type { HostScheduler } from '@/platform/bun/scheduler';

const confirmActionArgumentSchema = z.boolean();

export type HostRpcDependencies = {
  readonly actor: ApolloHostActor;
  readonly deviceName: string;
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly scheduler: HostScheduler;
  readonly mediaBlobStore: BlobStore;
  readonly vectorStore: VectorStore;
  readonly jobPublisher: JobPublisher;
};

// The durable object exposes these as @callable methods; on this host they are
// plain functions dispatched by method name over the same wire envelope. Every
// handler re-validates the dashboard secret carried in its payload, exactly
// like the durable object does — the connection identity is never trusted.
export async function executeConsoleRpcMethod(
  methodName: string,
  argumentList: readonly unknown[],
  dependencies: HostRpcDependencies,
): Promise<unknown> {
  const { actor, sqlExecutor, scheduler, environment, deviceName } = dependencies;

  async function assertDashboardSecret(presentedSecret: string): Promise<void> {
    const isAuthorized = await isDeviceSharedSecretValid(
      presentedSecret,
      environment.DASHBOARD_SHARED_SECRET,
    );
    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }
  }

  async function listReminderRowList() {
    return actor.listReminderRowList();
  }

  const firstArgument: unknown = argumentList[0];

  switch (methodName) {
    case 'getConsoleStatus': {
      const input = consoleSecretInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      await actor.ensureTelemetrySnapshotLoaded();
      const reminderList = await listReminderRowList();
      return buildConsoleStatusSnapshot({
        deviceConnectionCount: actor.getDeviceConnectionCount(),
        telemetrySnapshot: actor.getTelemetrySnapshot(),
        pendingReminderCount: reminderList.length,
        nowMilliseconds: Date.now(),
      });
    }
    case 'browseConsoleMemory': {
      const input = consoleMemoryBrowseInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return browseConsoleMemoryRecords(sqlExecutor, {
        query: input.query,
        limit: input.limit,
      });
    }
    case 'addConsoleMemory': {
      const input = consoleAddMemoryInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const memoryRecord = await addMemoryRecord(sqlExecutor, input.content);
      await rememberFactInSession(actor.activeSession(), input.content);
      await enqueueMemoryIndexJob(dependencies.jobPublisher, {
        memoryId: memoryRecord.id,
        content: input.content,
        deviceId: deviceName,
      });
      return browseConsoleMemoryRecords(sqlExecutor, {});
    }
    case 'deleteConsoleMemory': {
      const input = consoleDeleteMemoryInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      await deleteConsoleMemoryRecord(
        sqlExecutor,
        dependencies.vectorStore,
        input.memoryId,
      );
      return browseConsoleMemoryRecords(sqlExecutor, {});
    }
    case 'listConsoleLists': {
      const input = consoleSecretInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return listListItemRecords(sqlExecutor);
    }
    case 'addConsoleListItem': {
      const input = consoleAddListItemInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      await addListItemRecord(sqlExecutor, {
        listName: input.listName,
        content: input.content,
      });
      return listListItemRecords(sqlExecutor);
    }
    case 'removeConsoleListItem': {
      const input = consoleRemoveListItemInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      await removeListItemRecordById(sqlExecutor, input.itemId);
      return listListItemRecords(sqlExecutor);
    }
    case 'listConsoleReminders': {
      const input = consoleSecretInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return listReminderRowList();
    }
    case 'createConsoleReminder': {
      const input = consoleCreateReminderInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const message =
        input.isTimer === true ? `Timer terminado: ${input.message}.` : input.message;
      await scheduler.schedule(input.delaySeconds, 'deliverReminder', { message });
      if (input.isTimer === true) {
        actor.broadcastTimerArc({
          endsAtEpochSeconds: Math.floor(Date.now() / 1000) + input.delaySeconds,
          durationSeconds: input.delaySeconds,
        });
      }
      return listReminderRowList();
    }
    case 'cancelConsoleReminder': {
      const input = consoleCancelReminderInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      await scheduler.cancelSchedule(input.reminderId);
      await actor.broadcastSoonestRemainingTimerArc();
      return listReminderRowList();
    }
    case 'sendConsoleBroadcastText': {
      const input = consoleBroadcastTextInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const outcome = await deliverBroadcastText({
        message: input.message,
        connectionList: actor.getDeviceConnectionList(),
        sqlExecutor,
        environment,
        mediaBlobStore: dependencies.mediaBlobStore,
        ttsVoiceId: APOLLO_TTS_VOICE,
        isMockVoice: environment.MOCK_VOICE === '1',
        playChimeEffect: () =>
          actor.broadcastToDevices({ type: 'play_effect', name: 'chime' }),
      });
      return { outcome };
    }
    case 'getConsoleWeather': {
      const input = consoleSecretInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return actor.resolveWeatherLocation();
    }
    case 'setConsoleWeather': {
      const input = consoleWeatherInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const location = await geocodeDeskWeatherLocation({
        locationQuery: input.locationQuery,
      });
      await setSessionPreference(
        sqlExecutor,
        WEATHER_LOCATION_PREFERENCE_KEY,
        serializeWeatherLocation(location),
      );
      await actor.refreshDashboardWeather();
      return location;
    }
    case 'listConsoleThreads': {
      const input = consoleThreadListInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const sessionManager = actor.getSessionManager();
      const legacyMessageCount = await sessionManager.getMessageCount(
        LEGACY_THREAD_SESSION_ID,
      );
      return mapThreadCatalogToConsoleThreadList({
        sessionInfoList: sessionManager.list(),
        threadMetaList: listThreadMeta(sqlExecutor),
        activeThreadSessionId: actor.getActiveThreadSessionId(),
        hasLegacyHistory: legacyMessageCount > 0,
        legacySessionId: LEGACY_THREAD_SESSION_ID,
      });
    }
    case 'getConsoleThread': {
      const input = consoleThreadInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const recentHistory = await actor
        .getSessionManager()
        .getSession(input.threadId)
        .getRecentHistory(input.maxContentBytes ?? 48_000, 10);
      return mapSessionMessagesToConsoleHistory(recentHistory.messages);
    }
    case 'listConsoleJobs': {
      const input = consoleSecretInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return listConsoleJobDocuments(dependencies.mediaBlobStore, deviceName);
    }
    case 'getConsoleDocument': {
      const input = consoleDocumentInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      const content = await readConsoleJobDocument(
        dependencies.mediaBlobStore,
        deviceName,
        input.documentKey,
      );
      return { documentKey: input.documentKey, content };
    }
    case 'setConsoleSpeechMode': {
      const input = consoleSpeechModeInputSchema.parse(firstArgument);
      await assertDashboardSecret(input.secret);
      return setSpeechMode(input.speechModeId);
    }
    case 'setSpeechMode': {
      const speechModeId = z.string().parse(firstArgument);
      return setSpeechMode(speechModeId);
    }
    case 'confirmAction': {
      const isApproved = confirmActionArgumentSchema.parse(firstArgument);
      const deviceConnection = actor.getDeviceConnectionList()[0];
      if (deviceConnection !== undefined) {
        await actor.resolveConfirm(deviceConnection, isApproved);
      }
      return actor.getState();
    }
    case 'notifyBackgroundResult': {
      await actor.notifyBackgroundResult(firstArgument);
      return undefined;
    }
    default: {
      throw new Error(`El método ${methodName} todavía no corre en este host`);
    }
  }

  async function setSpeechMode(speechModeId: string) {
    const speechMode = resolveDeskSpeechMode(speechModeId);
    await setSessionPreference(sqlExecutor, 'speechMode', speechMode.id);
    actor.setState({ ...actor.getState(), speechMode: speechMode.id, caption: null });
    actor.pushUiStateToDevices();
    return actor.getState();
  }
}
