import type { Session, SessionManager } from 'agents/experimental/memory/session';

import {
  buildDeskDashboardPayload,
  DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
  resolveDeskDashboardWeatherSnapshot,
  shouldPushDashboardOnWeatherRefresh,
  UNAVAILABLE_WEATHER_CONDITION_LABEL,
} from '@/agents/dashboard';
import { createDeskToolEffects } from '@/agents/effects';
import {
  deliverDeskDeviceNotification,
  parsePendingDeviceMessageAsNotification,
} from '@/agents/notify';
import {
  deliverReminderPayloadSchema,
  expireConfirmPayloadSchema,
  notifyBackgroundResultInputSchema,
} from '@/agents/rpc';
import {
  concatenateArrayBufferList,
  executeApolloTurn,
  type TurnConnection,
} from '@/agents/runtime';
import type { ApolloState } from '@/agents/apollo';
import { replayPendingBroadcast, sweepExpiredBroadcasts } from '@/broadcast/deliver';
import { APOLLO_TTS_VOICE } from '@/configuration/identity';
import { createInactiveDeskFocusState, tickDeskFocus } from '@/focus/logic';
import type { DeskFocusState } from '@/focus/logic';
import {
  flattenRecentHistoryToTranscript,
  OWNER_MEMORY_CONSOLIDATION_CRON,
} from '@/memory/consolidate';
import { runOwnerMemoryConsolidation } from '@/memory/nightly';
import { deletePendingDeviceMessage, listPendingDeviceMessages } from '@/memory/pending';
import { LEGACY_THREAD_SESSION_ID } from '@/memory/session';
import { getSessionPreference, setSessionPreference } from '@/memory/store';
import type { MemorySqlExecutor } from '@/memory/store';
import { PUBLIC_ORIGIN_PREFERENCE_KEY } from '@/ota/lifecycle';
import type { BlobStore } from '@/platform/blob';
import type { HostSchedule, HostScheduler } from '@/platform/bun/scheduler';
import type { JobPublisher } from '@/platform/jobs';
import type { VectorStore } from '@/platform/vector';
import { resolveDeskSpeechMode } from '@/persona/catalog';
import { resolveDeskFaceEmotion } from '@/persona/face';
import {
  encodeServerToDeviceMessage,
  parseDeviceToServerMessage,
  type DeviceToServerMessage,
  type ServerToDeviceMessage,
} from '@/protocol/schema';
import {
  mapAgentScheduleListToReminderList,
  selectReminderRowsForCancel,
} from '@/reminders/logic';
import { createDeskUiMachine, type DeskUiMachine } from '@/session/machine';
import {
  parseStoredTelemetrySnapshot,
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import {
  deletePendingToolConfirmations,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';
import { ACTIVE_THREAD_SESSION_PREFERENCE_KEY } from '@/threads/lifecycle';
import { listThreadSessionIdsActiveSince } from '@/threads/store';
import type { PendingToolConfirmation } from '@/tools/types';
import type { DeskWeatherSnapshot } from '@/weather/fetch';
import {
  resolveDeskWeatherLocationFromPreferences,
  serializeWeatherLocation,
  WEATHER_LOCATION_PREFERENCE_KEY,
} from '@/weather/location';

const MINIMUM_TURN_AUDIO_BYTE_LENGTH = 8_000;
const TELEMETRY_SNAPSHOT_PREFERENCE_KEY = 'lastTelemetrySnapshot';

export type HostConnection = TurnConnection;

export type ApolloHostActorDependencies = {
  readonly deviceName: string;
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly sessionManager: SessionManager;
  readonly scheduler: HostScheduler;
  readonly mediaBlobStore: BlobStore;
  readonly vectorStore: VectorStore;
  readonly jobPublisher: JobPublisher;
  readonly onStateChanged: (state: ApolloState) => void;
};

export function createApolloHostActor(dependencies: ApolloHostActorDependencies) {
  const { deviceName, environment, sqlExecutor, sessionManager, scheduler } =
    dependencies;
  const uiMachine: DeskUiMachine = createDeskUiMachine('idle');
  const deviceConnectionSet = new Set<HostConnection>();
  let state: ApolloState = {
    uiState: 'idle',
    speechMode: 'default',
    focusEndsAt: null,
    focusStartedAt: null,
    caption: null,
    pendingConfirmId: null,
    pendingConfirmSummary: null,
  };
  let audioChunkList: ArrayBuffer[] = [];
  let isSpeechAborted = false;
  let pendingConfirmation: PendingToolConfirmation | undefined;
  let activeThreadSessionId: string | undefined;
  let lastKnownWeatherSnapshot: DeskWeatherSnapshot | undefined;
  let lastTelemetrySnapshot: DeskTelemetrySnapshot | undefined;
  let ttsSequence = 0;
  let lastPlaybackAck: {
    readonly sequence: number;
    readonly playedMilliseconds: number;
    readonly receivedAtMilliseconds: number;
  } | null = null;
  let isConsolidatingMemory = false;

  const isMockVoice = (): boolean => environment.MOCK_VOICE === '1';
  const activeSession = (): Session =>
    sessionManager.getSession(activeThreadSessionId ?? LEGACY_THREAD_SESSION_ID);

  function setState(nextState: ApolloState): void {
    state = nextState;
    dependencies.onStateChanged(state);
  }

  function applyUiEvent(eventName: Parameters<DeskUiMachine['transition']>[0]): void {
    uiMachine.transition(eventName);
    setState({ ...state, uiState: uiMachine.state });
  }

  function currentFocusState(): DeskFocusState {
    if (state.focusEndsAt === null) {
      return createInactiveDeskFocusState();
    }
    return tickDeskFocus({ active: true, endsAt: state.focusEndsAt }, Date.now());
  }

  function broadcastToDevices(message: ServerToDeviceMessage): void {
    const encodedMessage = encodeServerToDeviceMessage(message);
    for (const connection of deviceConnectionSet) {
      connection.send(encodedMessage);
    }
  }

  function pushUiState(connection: HostConnection): void {
    const uiStateMessage: Extract<ServerToDeviceMessage, { type: 'ui_state' }> = {
      type: 'ui_state',
      state: state.uiState,
      speechMode: state.speechMode,
      caption: state.caption ?? undefined,
      emotion: resolveDeskFaceEmotion(state.uiState),
      accentColor: resolveDeskSpeechMode(state.speechMode).accentColor,
    };
    if (state.focusEndsAt !== null) {
      uiStateMessage.focusRemainingSec = Math.max(
        0,
        Math.ceil((state.focusEndsAt - Date.now()) / 1000),
      );
      uiStateMessage.focusEndsAt = Math.floor(state.focusEndsAt / 1000);
      if (state.focusStartedAt !== null) {
        uiStateMessage.focusStartedAt = Math.floor(state.focusStartedAt / 1000);
      }
    }
    connection.send(encodeServerToDeviceMessage(uiStateMessage));
  }

  function pushUiStateToDevices(): void {
    for (const connection of deviceConnectionSet) {
      pushUiState(connection);
    }
  }

  async function resolveWeatherLocation() {
    return resolveDeskWeatherLocationFromPreferences(async () =>
      getSessionPreference(sqlExecutor, WEATHER_LOCATION_PREFERENCE_KEY),
    );
  }

  async function pushDashboard(connection: HostConnection): Promise<void> {
    const location = await resolveWeatherLocation();
    const weatherSnapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      lastKnownSnapshot: lastKnownWeatherSnapshot,
    });
    if (weatherSnapshot.conditionLabel !== UNAVAILABLE_WEATHER_CONDITION_LABEL) {
      lastKnownWeatherSnapshot = weatherSnapshot;
    }
    const dashboardPayload = await buildDeskDashboardPayload({
      timezone: location.timezone,
      weather: weatherSnapshot,
    });
    connection.send(encodeServerToDeviceMessage(dashboardPayload));
  }

  async function listReminderRowList() {
    return mapAgentScheduleListToReminderList(await scheduler.listSchedules());
  }

  function broadcastTimerArc(
    arc:
      | { readonly endsAtEpochSeconds: number; readonly durationSeconds: number }
      | undefined,
  ): void {
    broadcastToDevices(
      arc === undefined
        ? { type: 'timer' }
        : {
            type: 'timer',
            endsAt: arc.endsAtEpochSeconds,
            durationSeconds: arc.durationSeconds,
          },
    );
  }

  async function broadcastSoonestRemainingTimerArc(): Promise<void> {
    const remainingTimerList = (await listReminderRowList())
      .filter(
        (reminder) =>
          reminder.message.startsWith('Timer') && reminder.delayInSeconds !== undefined,
      )
      .toSorted((left, right) => left.firesAtIso.localeCompare(right.firesAtIso));
    const soonestTimer = remainingTimerList[0];
    if (soonestTimer === undefined || soonestTimer.delayInSeconds === undefined) {
      broadcastTimerArc(undefined);
      return;
    }
    broadcastTimerArc({
      endsAtEpochSeconds: Math.floor(new Date(soonestTimer.firesAtIso).getTime() / 1000),
      durationSeconds: soonestTimer.delayInSeconds,
    });
  }

  async function ensureTelemetrySnapshotLoaded(): Promise<void> {
    if (lastTelemetrySnapshot !== undefined) {
      return;
    }
    const storedSnapshot = await getSessionPreference(
      sqlExecutor,
      TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
    );
    if (storedSnapshot !== null) {
      lastTelemetrySnapshot = parseStoredTelemetrySnapshot(storedSnapshot);
    }
  }

  async function executeTurn(
    connection: HostConnection,
    turnPart: {
      readonly text?: string;
      readonly audioBuffer?: ArrayBuffer;
      readonly confirmOk?: boolean;
      readonly pendingConfirmation?: PendingToolConfirmation;
    },
  ): Promise<void> {
    isSpeechAborted = false;
    await ensureTelemetrySnapshotLoaded();
    const deskToolEffects = createDeskToolEffects({
      sqlExecutor,
      jobPublisher: dependencies.jobPublisher,
      deviceId: deviceName,
      session: activeSession(),
      applyFocusMinutes: async (minutes) => {
        const startedAt = Date.now();
        setState({
          ...state,
          focusEndsAt: startedAt + minutes * 60_000,
          focusStartedAt: startedAt,
        });
      },
      clearFocus: async () => {
        setState({ ...state, focusEndsAt: null, focusStartedAt: null });
      },
      scheduleReminder: async ({ delaySeconds, message }) => {
        await scheduler.schedule(delaySeconds, 'deliverReminder', { message });
      },
      broadcastTimerProgress: async ({ durationSeconds }) => {
        broadcastTimerArc({
          endsAtEpochSeconds: Math.floor(Date.now() / 1000) + durationSeconds,
          durationSeconds,
        });
      },
      listReminders: async () => listReminderRowList(),
      cancelReminders: async ({ message, cancelAll }) => {
        const selectedReminderList = selectReminderRowsForCancel(
          await listReminderRowList(),
          { message, cancelAll },
        );
        const cancelledMessageList: string[] = [];
        for (const reminder of selectedReminderList) {
          if (await scheduler.cancelSchedule(reminder.id)) {
            cancelledMessageList.push(reminder.message);
          }
        }
        if (cancelledMessageList.some((cancelled) => cancelled.startsWith('Timer'))) {
          await broadcastSoonestRemainingTimerArc();
        }
        return {
          cancelledCount: cancelledMessageList.length,
          cancelledMessageList,
        };
      },
      resolveWeatherLocation: async () => resolveWeatherLocation(),
      persistWeatherLocation: async (location) => {
        await setSessionPreference(
          sqlExecutor,
          WEATHER_LOCATION_PREFERENCE_KEY,
          serializeWeatherLocation(location),
        );
      },
      searchThreadHistory: async ({ query, limit }) =>
        sessionManager.search(query, { limit }).map((match) => ({
          id: match.id,
          role: match.role,
          content: match.content,
        })),
      resumeConversationThread: async () => undefined,
      // The device MCP bridge and installed MCP servers arrive in a later
      // phase 2 increment; the tools degrade with an explicit failure.
      callDeviceTool: async () => ({
        ok: false,
        summary: 'El puente MCP del dispositivo todavía no corre en este host',
      }),
      callInstalledMcpTool: async () => ({
        ok: false,
        summary: 'Los servidores MCP instalados todavía no corren en este host',
      }),
    });

    try {
      await executeApolloTurn(
        connection,
        {
          environment,
          mediaBlobStore: dependencies.mediaBlobStore,
          vectorStore: dependencies.vectorStore,
          sqlExecutor,
          uiMachine,
          currentState: state,
          getCurrentState: () => state,
          setAgentState: (nextState) => {
            setState(nextState);
          },
          scheduleConfirmExpiry: async (confirmationId) => {
            await scheduler.schedule(30, 'expireConfirm', { confirmationId });
          },
          persistPendingConfirmation: async (confirmation) => {
            pendingConfirmation = confirmation;
            await savePendingToolConfirmation(sqlExecutor, confirmation);
          },
          session: activeSession(),
          deviceId: deviceName,
          effects: deskToolEffects,
          toolDefinitionMap: createBuiltinToolDefinitionMap(),
          isSpeechAborted: () => isSpeechAborted,
          allocateTtsSequence: () => {
            ttsSequence += 1;
            return ttsSequence;
          },
          getPlaybackAckForSequence: (sequence) =>
            lastPlaybackAck !== null && lastPlaybackAck.sequence === sequence
              ? {
                  playedMilliseconds: lastPlaybackAck.playedMilliseconds,
                  receivedAtMilliseconds: lastPlaybackAck.receivedAtMilliseconds,
                }
              : null,
          telemetrySnapshot: lastTelemetrySnapshot,
        },
        turnPart,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apollo_turn_failed',
          deviceId: deviceName,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      pendingConfirmation = undefined;
      await deletePendingToolConfirmations(sqlExecutor);
      uiMachine.transition('CANCEL');
      setState({
        ...state,
        uiState: uiMachine.state,
        caption: 'No pude procesar ese pedido, intentá de nuevo.',
        pendingConfirmId: null,
        pendingConfirmSummary: null,
      });
      connection.send(
        encodeServerToDeviceMessage({ type: 'play_effect', name: 'error' }),
      );
      connection.send(
        encodeServerToDeviceMessage({
          type: 'error',
          code: 'turn_failed',
          message: 'No pude procesar ese pedido',
        }),
      );
    }
  }

  async function runTurnFromAudio(connection: HostConnection): Promise<void> {
    const audioBuffer = concatenateArrayBufferList(audioChunkList);
    audioChunkList = [];
    if (audioBuffer.byteLength < MINIMUM_TURN_AUDIO_BYTE_LENGTH) {
      uiMachine.transition('CANCEL');
      setState({
        ...state,
        uiState: uiMachine.state,
        caption: 'No llegué a escucharte, mantené apretado un momento más.',
      });
      pushUiState(connection);
      return;
    }
    await executeTurn(connection, { audioBuffer });
  }

  async function resolveConfirm(
    connection: HostConnection,
    isApproved: boolean,
  ): Promise<void> {
    const restoredConfirmation =
      pendingConfirmation ?? (await readPendingToolConfirmation(sqlExecutor));
    if (restoredConfirmation === undefined) {
      return;
    }
    pendingConfirmation = undefined;
    await deletePendingToolConfirmations(sqlExecutor);
    broadcastToDevices({
      type: 'confirm_close',
      id: restoredConfirmation.id,
      reason: 'resolved',
    });
    await executeTurn(connection, {
      text: isApproved ? 'confirmado' : 'cancelado',
      confirmOk: isApproved,
      pendingConfirmation: restoredConfirmation,
    });
  }

  async function closePendingConfirmation(caption: string): Promise<void> {
    const closingConfirmId = state.pendingConfirmId ?? pendingConfirmation?.id ?? null;
    if (closingConfirmId !== null) {
      broadcastToDevices({
        type: 'confirm_close',
        id: closingConfirmId,
        reason: 'expired',
      });
    }
    pendingConfirmation = undefined;
    await deletePendingToolConfirmations(sqlExecutor);
    setState({
      ...state,
      caption,
      pendingConfirmId: null,
      pendingConfirmSummary: null,
    });
    pushUiStateToDevices();
  }

  async function notifyBackgroundResult(rawNotification: unknown): Promise<void> {
    const notification = notifyBackgroundResultInputSchema.parse(rawNotification);
    await deliverDeskDeviceNotification({
      notification: {
        type: 'background_result',
        prompt: notification.prompt,
        summary: notification.summary,
        documentKey: notification.documentKey,
      },
      connectionList: [...deviceConnectionSet],
      sqlExecutor,
      focusState: currentFocusState(),
      environment,
      mediaBlobStore: dependencies.mediaBlobStore,
      deviceId: deviceName,
      ttsVoiceId: APOLLO_TTS_VOICE,
      isMockVoice: isMockVoice(),
    });
  }

  async function refreshDashboardWeather(): Promise<void> {
    const location = await resolveWeatherLocation();
    const weatherSnapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      lastKnownSnapshot: lastKnownWeatherSnapshot,
    });
    if (weatherSnapshot.conditionLabel !== UNAVAILABLE_WEATHER_CONDITION_LABEL) {
      lastKnownWeatherSnapshot = weatherSnapshot;
    }
    if (
      !shouldPushDashboardOnWeatherRefresh({
        uiState: state.uiState,
        connectionCount: deviceConnectionSet.size,
      })
    ) {
      return;
    }
    const dashboardPayload = await buildDeskDashboardPayload({
      timezone: location.timezone,
      weather: weatherSnapshot,
    });
    broadcastToDevices(dashboardPayload);
  }

  async function gatherThreadTranscriptSince(
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
  }

  async function dispatchSchedule(schedule: HostSchedule): Promise<void> {
    if (schedule.callback === 'deliverReminder') {
      const payload = deliverReminderPayloadSchema.parse(schedule.payload);
      broadcastToDevices({ type: 'play_effect', name: 'ding' });
      await deliverDeskDeviceNotification({
        notification: { type: 'reminder', message: payload.message },
        connectionList: [...deviceConnectionSet],
        sqlExecutor,
        focusState: currentFocusState(),
        environment,
        mediaBlobStore: dependencies.mediaBlobStore,
        deviceId: deviceName,
        ttsVoiceId: APOLLO_TTS_VOICE,
        isMockVoice: isMockVoice(),
      });
      return;
    }
    if (schedule.callback === 'expireConfirm') {
      const parsedPayload = expireConfirmPayloadSchema.safeParse(schedule.payload);
      if (state.pendingConfirmId === null) {
        return;
      }
      if (
        parsedPayload.success &&
        state.pendingConfirmId !== parsedPayload.data.confirmationId
      ) {
        return;
      }
      await closePendingConfirmation('Confirmación expirada');
      return;
    }
    if (schedule.callback === 'refreshDashboardWeather') {
      await refreshDashboardWeather();
      return;
    }
    if (schedule.callback === 'consolidateOwnerMemory') {
      if (isConsolidatingMemory) {
        return;
      }
      isConsolidatingMemory = true;
      try {
        await runOwnerMemoryConsolidation({
          sqlExecutor,
          session: activeSession(),
          environment,
          jobPublisher: dependencies.jobPublisher,
          deviceId: deviceName,
          nowMilliseconds: Date.now(),
          createIdentifier: () => crypto.randomUUID(),
          gatherTranscriptSince: async (sinceMilliseconds, transcriptByteBudget) =>
            gatherThreadTranscriptSince(sinceMilliseconds, transcriptByteBudget),
        });
      } finally {
        isConsolidatingMemory = false;
      }
      return;
    }
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'host_schedule_callback_unhandled',
        callback: schedule.callback,
      }),
    );
  }

  async function flushPendingDeviceMessages(connection: HostConnection): Promise<void> {
    const pendingMessageList = await sweepExpiredBroadcasts({
      pendingMessageList: await listPendingDeviceMessages(sqlExecutor),
      sqlExecutor,
      mediaBlobStore: dependencies.mediaBlobStore,
      nowMilliseconds: Date.now(),
    });
    for (const pendingMessage of pendingMessageList) {
      if (
        pendingMessage.type === 'broadcast_text' ||
        pendingMessage.type === 'broadcast_audio'
      ) {
        await replayPendingBroadcast({
          pendingMessage,
          connectionList: [connection],
          mediaBlobStore: dependencies.mediaBlobStore,
          environment,
          ttsVoiceId: APOLLO_TTS_VOICE,
          isMockVoice: isMockVoice(),
          playChimeEffect: () =>
            broadcastToDevices({ type: 'play_effect', name: 'chime' }),
        });
      } else {
        connection.send(
          encodeServerToDeviceMessage(
            parsePendingDeviceMessageAsNotification(pendingMessage),
          ),
        );
      }
      await deletePendingDeviceMessage(sqlExecutor, pendingMessage.id);
    }
  }

  async function handleDeviceMessage(
    connection: HostConnection,
    rawMessage: string | ArrayBuffer,
  ): Promise<void> {
    if (rawMessage instanceof ArrayBuffer) {
      audioChunkList.push(rawMessage);
      return;
    }
    let deviceMessage: DeviceToServerMessage;
    try {
      deviceMessage = parseDeviceToServerMessage(rawMessage);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apollo_device_message_invalid',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      connection.send(
        encodeServerToDeviceMessage({
          type: 'error',
          code: 'invalid_message',
          message: 'Mensaje no reconocido',
        }),
      );
      return;
    }
    switch (deviceMessage.type) {
      case 'hello': {
        pushUiState(connection);
        break;
      }
      case 'hold_start':
      case 'wake': {
        audioChunkList = [];
        applyUiEvent('START_LISTEN');
        setState({ ...state, caption: null });
        pushUiState(connection);
        break;
      }
      case 'hold_end':
      case 'audio_end': {
        await runTurnFromAudio(connection);
        break;
      }
      case 'listen_cancel': {
        audioChunkList = [];
        applyUiEvent('CANCEL');
        pushUiState(connection);
        break;
      }
      case 'text_input': {
        applyUiEvent('START_LISTEN');
        await executeTurn(connection, { text: deviceMessage.text });
        break;
      }
      case 'abort': {
        isSpeechAborted = true;
        break;
      }
      case 'confirm': {
        await resolveConfirm(connection, deviceMessage.ok);
        break;
      }
      case 'telemetry': {
        lastTelemetrySnapshot = {
          battery: deviceMessage.battery,
          charging: deviceMessage.charging,
          volume: deviceMessage.volume,
          wifiRssi: deviceMessage.wifiRssi,
          firmwareVersion: deviceMessage.firmwareVersion,
          receivedAtMs: Date.now(),
        };
        await setSessionPreference(
          sqlExecutor,
          TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
          JSON.stringify(lastTelemetrySnapshot),
        );
        break;
      }
      case 'playback_ack': {
        lastPlaybackAck = {
          sequence: deviceMessage.sequence,
          playedMilliseconds: deviceMessage.playedMilliseconds,
          receivedAtMilliseconds: Date.now(),
        };
        break;
      }
      default: {
        // gesture and mcp ride later phase 2 increments (device MCP bridge).
        break;
      }
    }
  }

  return {
    getState: () => state,
    setState,
    getDeviceConnectionCount: () => deviceConnectionSet.size,
    getDeviceConnectionList: () => [...deviceConnectionSet],
    getTelemetrySnapshot: () => lastTelemetrySnapshot,
    getSessionManager: () => sessionManager,
    getActiveThreadSessionId: () => activeThreadSessionId ?? null,
    listReminderRowList,
    broadcastTimerArc,
    broadcastSoonestRemainingTimerArc,
    broadcastToDevices,
    pushUiStateToDevices,
    ensureTelemetrySnapshotLoaded,
    resolveWeatherLocation,
    refreshDashboardWeather,
    activeSession,
    resolveConfirm,
    notifyBackgroundResult,
    dispatchSchedule,
    async start(): Promise<void> {
      const storedActiveThreadSessionId = await getSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
      );
      if (
        storedActiveThreadSessionId !== null &&
        storedActiveThreadSessionId.length > 0
      ) {
        activeThreadSessionId = storedActiveThreadSessionId;
      }
      const storedSpeechModeId = await getSessionPreference(sqlExecutor, 'speechMode');
      if (storedSpeechModeId !== null) {
        state = { ...state, speechMode: resolveDeskSpeechMode(storedSpeechModeId).id };
      }
      const scheduleList = await scheduler.listSchedules();
      if (
        !scheduleList.some((schedule) => schedule.callback === 'refreshDashboardWeather')
      ) {
        await scheduler.scheduleEvery(
          DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
          'refreshDashboardWeather',
        );
      }
      if (
        !scheduleList.some((schedule) => schedule.callback === 'consolidateOwnerMemory')
      ) {
        await scheduler.schedule(
          OWNER_MEMORY_CONSOLIDATION_CRON,
          'consolidateOwnerMemory',
        );
      }
    },
    async handleDeviceConnect(
      connection: HostConnection,
      requestOrigin: string,
    ): Promise<void> {
      deviceConnectionSet.add(connection);
      const storedPublicOrigin = await getSessionPreference(
        sqlExecutor,
        PUBLIC_ORIGIN_PREFERENCE_KEY,
      );
      if (storedPublicOrigin !== requestOrigin) {
        await setSessionPreference(
          sqlExecutor,
          PUBLIC_ORIGIN_PREFERENCE_KEY,
          requestOrigin,
        );
      }
      if (state.caption !== null) {
        setState({ ...state, caption: null });
      }
      pushUiState(connection);
      await pushDashboard(connection);
      await flushPendingDeviceMessages(connection);
    },
    handleDeviceDisconnect(connection: HostConnection): void {
      deviceConnectionSet.delete(connection);
    },
    handleDeviceMessage,
  };
}

export type ApolloHostActor = ReturnType<typeof createApolloHostActor>;
