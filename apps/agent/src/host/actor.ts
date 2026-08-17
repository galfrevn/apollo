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
import { OWNER_MEMORY_CONSOLIDATION_CRON } from '@/memory/consolidate';
import { runOwnerMemoryConsolidation } from '@/memory/nightly';
import { deletePendingDeviceMessage, listPendingDeviceMessages } from '@/memory/pending';
import { LEGACY_THREAD_SESSION_ID } from '@/memory/session';
import { getSessionPreference, setSessionPreference } from '@/memory/store';
import type { MemorySqlExecutor } from '@/memory/store';
import { PUBLIC_ORIGIN_PREFERENCE_KEY } from '@/ota/lifecycle';
import type { BlobStore } from '@/platform/blob';
import type { HostInitiativeEngine } from '@/host/initiative';
import type { HostMcpManager } from '@/host/mcp';
import type { HostThreadEngine } from '@/host/threads';
import {
  buildDeviceToolCallPayload,
  createDeviceMcpRequestRegistry,
  DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
  summarizeDeviceToolResult,
  type DeviceToolArgumentRecord,
} from '@/mcp/bridge';
import {
  buildTurnToolDefinitionMap,
  callInstalledMcpTool,
  discoverInstalledMcpToolList,
} from '@/mcp/runtime';
import { listMcpToolSettings } from '@/mcp/settings';
import { hasScheduledInitiativeRetryForSource } from '@/initiative/logic';
import { runFirmwareLifecycle } from '@/ota/lifecycle';
import type { HostSchedule, HostScheduler } from '@/platform/bun/scheduler';
import type { JobPublisher } from '@/platform/jobs';
import type { VectorStore } from '@/platform/vector';
import { cycleDeskSpeechMode, resolveDeskSpeechMode } from '@/persona/catalog';
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
import type { ToolDefinition, ToolExecutionResult } from '@/tools/types';
import {
  deletePendingToolConfirmations,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';
import { ACTIVE_THREAD_SESSION_PREFERENCE_KEY } from '@/threads/lifecycle';
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
  const deviceMcpRequestRegistry = createDeviceMcpRequestRegistry();
  let attachedEngines:
    | {
        readonly threadEngine: HostThreadEngine;
        readonly initiativeEngine: HostInitiativeEngine;
        readonly mcpManager: HostMcpManager | undefined;
      }
    | undefined;

  function requireEngines() {
    if (attachedEngines === undefined) {
      throw new Error('attachEngines must run before the actor serves traffic');
    }
    return attachedEngines;
  }

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

  async function callDeviceTool(
    deviceToolName: string,
    argumentRecord: DeviceToolArgumentRecord,
  ): Promise<ToolExecutionResult> {
    if (deviceConnectionSet.size === 0) {
      return { ok: false, summary: 'El dispositivo no está conectado.' };
    }
    const { requestId, responsePromise } = deviceMcpRequestRegistry.createPendingRequest(
      DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
    );
    broadcastToDevices({
      type: 'mcp',
      payload: buildDeviceToolCallPayload(requestId, deviceToolName, argumentRecord),
    });
    return summarizeDeviceToolResult(await responsePromise);
  }

  async function buildHostTurnToolDefinitionMap(
    effects: Parameters<typeof buildTurnToolDefinitionMap>[0]['callInstalledMcpTool'],
  ): Promise<ReadonlyMap<string, ToolDefinition>> {
    const mcpManager = requireEngines().mcpManager;
    if (mcpManager === undefined) {
      return createBuiltinToolDefinitionMap();
    }
    const [discoveredToolList, settingList] = await Promise.all([
      discoverInstalledMcpToolList(mcpManager.manager),
      listMcpToolSettings(sqlExecutor),
    ]);
    return buildTurnToolDefinitionMap({
      discoveredToolList,
      settingList,
      serverRecordMap: mcpManager.buildServerRecordMap(),
      callInstalledMcpTool: effects,
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
    await requireEngines().threadEngine.rotateForTurn();
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
      resumeConversationThread: async (input) =>
        requireEngines().threadEngine.resumeConversationThread(input.query),
      callDeviceTool: async ({ deviceToolName, argumentRecord }) =>
        callDeviceTool(deviceToolName, argumentRecord),
      callInstalledMcpTool: async (call) => {
        const mcpManager = requireEngines().mcpManager;
        if (mcpManager === undefined) {
          return { ok: false, summary: 'Los servidores MCP no están habilitados' };
        }
        return callInstalledMcpTool(mcpManager.manager, call);
      },
    });
    const toolDefinitionMap = await buildHostTurnToolDefinitionMap(
      deskToolEffects.callInstalledMcpTool,
    );

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
          toolDefinitionMap,
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
      // Mock mode has no LLM to call; a dev session must not burn tokens.
      if (isMockVoice() || isConsolidatingMemory) {
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
            requireEngines().threadEngine.gatherThreadTranscriptSince(
              sinceMilliseconds,
              transcriptByteBudget,
            ),
        });
      } finally {
        isConsolidatingMemory = false;
      }
      return;
    }
    if (schedule.callback === 'finalizeThread') {
      await requireEngines().threadEngine.finalizeThread(schedule.payload);
      return;
    }
    if (schedule.callback === 'maybeFinalizeIdleThread') {
      await requireEngines().threadEngine.maybeFinalizeIdleThread();
      return;
    }
    if (schedule.callback === 'retryInitiativeUtterance') {
      await requireEngines().initiativeEngine.retryInitiativeUtterance(schedule.payload);
      return;
    }
    if (schedule.callback === 'purgeExpiredCommandThreads') {
      await requireEngines().threadEngine.purgeExpiredCommandThreads();
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

  async function handleGesture(
    connection: HostConnection,
    gesture: Extract<DeviceToServerMessage, { type: 'gesture' }>['gesture'],
  ): Promise<void> {
    if (gesture === 'tap') {
      const previousUiState = state.uiState;
      if (previousUiState === 'dashboard') {
        applyUiEvent('CLOSE_DASHBOARD');
      } else if (previousUiState === 'idle') {
        applyUiEvent('OPEN_DASHBOARD');
      }
      pushUiState(connection);
      if (previousUiState === 'idle' && state.uiState === 'dashboard') {
        await pushDashboard(connection);
      }
      return;
    }
    if (gesture === 'double_tap') {
      // Muting used to live here. With press-and-hold the microphone is only
      // ever open while a finger is down, so there is nothing to mute.
      return;
    }
    const direction = gesture === 'swipe_right' ? 1 : -1;
    const nextSpeechMode = cycleDeskSpeechMode(state.speechMode, direction);
    await setSessionPreference(sqlExecutor, 'speechMode', nextSpeechMode.id);
    // No caption on purpose: the mode change is announced by the accent ring
    // color (and the switch sound), not by a text label.
    setState({ ...state, speechMode: nextSpeechMode.id, caption: null });
    pushUiState(connection);
  }

  async function handleTelemetry(
    deviceMessage: Extract<DeviceToServerMessage, { type: 'telemetry' }>,
  ): Promise<void> {
    const snapshot: DeskTelemetrySnapshot = {
      battery: deviceMessage.battery,
      charging: deviceMessage.charging,
      volume: deviceMessage.volume,
      wifiRssi: deviceMessage.wifiRssi,
      firmwareVersion: deviceMessage.firmwareVersion,
      receivedAtMs: Date.now(),
    };
    // The previous snapshot is read before the overwrite because the firmware
    // lifecycle diffs versions across it — after a restart the in-memory copy
    // is gone, which is exactly the post-OTA-reboot case.
    let previousSnapshot = lastTelemetrySnapshot;
    if (previousSnapshot === undefined) {
      const storedSnapshot = await getSessionPreference(
        sqlExecutor,
        TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
      );
      if (storedSnapshot !== null) {
        previousSnapshot = parseStoredTelemetrySnapshot(storedSnapshot);
      }
    }
    const didChargingEdgeOccur =
      previousSnapshot?.charging !== undefined &&
      snapshot.charging !== undefined &&
      previousSnapshot.charging !== snapshot.charging;
    lastTelemetrySnapshot = snapshot;
    await setSessionPreference(
      sqlExecutor,
      TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
      JSON.stringify(snapshot),
    );

    const { initiativeEngine } = requireEngines();
    await initiativeEngine.handleLowBatteryAnnouncement(snapshot);
    try {
      await runFirmwareLifecycle(
        {
          previousFirmwareVersion: previousSnapshot?.firmwareVersion,
          snapshot,
          didChargingEdgeOccur,
        },
        {
          sqlExecutor,
          mediaBlobStore: dependencies.mediaBlobStore,
          deviceSharedSecret: environment.DEVICE_SHARED_SECRET,
          isPushDisabled: environment.FIRMWARE_PUSH_DISABLED === '1',
          uiState: state.uiState,
          isFocusActive: currentFocusState().active,
          hasPendingConfirmation: state.pendingConfirmId !== null,
          isAnnouncementInFlight: initiativeEngine.isAnnouncementInFlight(),
          nowMilliseconds: Date.now(),
          deliverInitiativeUtterance: (utterance) =>
            initiativeEngine.deliverInitiativeUtterance(utterance),
          hasScheduledInitiativeRetry: async (source) =>
            hasScheduledInitiativeRetryForSource(await scheduler.listSchedules(), source),
          callDeviceTool: (deviceToolName, argumentRecord) =>
            callDeviceTool(deviceToolName, argumentRecord),
        },
      );
    } catch (error) {
      // OTA plumbing must never take telemetry handling down with it.
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'firmware_lifecycle_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
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
        await handleTelemetry(deviceMessage);
        break;
      }
      case 'gesture': {
        await handleGesture(connection, deviceMessage.gesture);
        break;
      }
      case 'mcp': {
        deviceMcpRequestRegistry.resolvePendingRequest(deviceMessage.payload);
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
        break;
      }
    }
  }

  return {
    getState: () => state,
    setState,
    attachEngines(engines: NonNullable<typeof attachedEngines>): void {
      attachedEngines = engines;
    },
    callDeviceTool,
    currentFocusState,
    getActiveThreadSessionIdSetter: () => ({
      get: () => activeThreadSessionId,
      set: (sessionId: string | undefined) => {
        activeThreadSessionId = sessionId;
      },
    }),
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
      if (
        !scheduleList.some(
          (schedule) => schedule.callback === 'purgeExpiredCommandThreads',
        )
      ) {
        await scheduler.scheduleEvery(86_400, 'purgeExpiredCommandThreads');
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
