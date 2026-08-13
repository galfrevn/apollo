import {
  Agent,
  callable,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from 'agents';
import type { Session, SessionManager } from 'agents/experimental/memory/session';
import type { z } from 'zod';

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
  retryInitiativeUtterancePayloadSchema,
} from '@/agents/rpc';
import { concatenateArrayBufferList, executeApolloTurn } from '@/agents/runtime';
import {
  deliverBroadcastAudio,
  deliverBroadcastText,
  replayPendingBroadcast,
  sweepExpiredBroadcasts,
} from '@/broadcast/deliver';
import {
  appendBroadcastUploadChunk,
  assembleBroadcastUploadAudio,
  createBroadcastUploadSession,
  isBroadcastUploadSessionExpired,
  type BroadcastDeliveryOutcome,
  type BroadcastUploadSession,
} from '@/broadcast/logic';
import {
  DEVICE_CONNECTION_TAG,
  hasDeviceConnectionTag,
  resolveApolloConnectionRole,
} from '@/auth/role';
import { isDeviceSharedSecretValid } from '@/auth/token';
import {
  mapSessionMessagesToConsoleHistory,
  mapThreadCatalogToConsoleThreadList,
  type ConsoleHistoryTurn,
  type ConsoleThreadSummary,
} from '@/console/history';
import {
  listConsoleJobDocuments,
  readConsoleJobDocument,
  type ConsoleJobDocument,
} from '@/console/jobs';
import {
  browseConsoleMemory as browseConsoleMemoryRecords,
  deleteConsoleMemory as deleteConsoleMemoryRecord,
  type ConsoleMemoryBrowseResult,
} from '@/console/memory';
import {
  consoleAddListItemInputSchema,
  consoleAddMemoryInputSchema,
  consoleBroadcastTextInputSchema,
  consoleBroadcastUploadBeginInputSchema,
  consoleBroadcastUploadChunkInputSchema,
  consoleBroadcastUploadCommitInputSchema,
  consoleCancelReminderInputSchema,
  consoleCreateReminderInputSchema,
  consoleDeleteMemoryInputSchema,
  consoleDeviceBrightnessInputSchema,
  consoleDeviceVolumeInputSchema,
  consoleDocumentInputSchema,
  consoleMemoryBrowseInputSchema,
  consoleRemoveListItemInputSchema,
  consoleSecretInputSchema,
  consoleSpeechModeInputSchema,
  consoleThreadInputSchema,
  consoleThreadListInputSchema,
  consoleWeatherInputSchema,
} from '@/console/rpc';
import { buildConsoleStatusSnapshot, type ConsoleStatusSnapshot } from '@/console/status';
import {
  clearDeskFocus,
  createInactiveDeskFocusState,
  startDeskFocus,
  tickDeskFocus,
  type DeskFocusState,
} from '@/focus/logic';
import {
  buildInitiativeDeliveryMarkerKey,
  evaluateInitiativeCandidate,
  hasScheduledInitiativeRetryForSource,
  INITIATIVE_MAX_RETRY_ATTEMPTS,
  INITIATIVE_SUPPRESSED_RETRY_DELAY_SECONDS,
  parseStoredInitiativeState,
  recordInitiativeDelivery,
  type InitiativeDeliveryOutcome,
  type InitiativeUtteranceInput,
} from '@/initiative/logic';
import {
  addListItemRecord,
  listListItemRecords,
  removeListItemRecordById,
  type ListItemRecord,
} from '@/lists/store';
import { resolveDiscoveredMcpToolSafety } from '@/mcp/adapter';
import {
  buildDeviceToolCallPayload,
  createDeviceMcpRequestRegistry,
  DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
  summarizeDeviceToolResult,
} from '@/mcp/bridge';
import { buildMcpOauthLandingResponse } from '@/mcp/landing';
import { buildNamespacedMcpToolName } from '@/mcp/naming';
import {
  buildInstalledMcpServerSummaryList,
  buildTurnToolDefinitionMap,
  callInstalledMcpTool,
  discoverInstalledMcpToolList,
} from '@/mcp/runtime';
import {
  installMcpServerInputSchema,
  mcpSecretInputSchema,
  removeMcpServerInputSchema,
  retryMcpServerInputSchema,
  setMcpToolEnabledInputSchema,
  type InstallMcpServerInput,
  type McpServerSummary,
  type SetMcpToolEnabledInput,
} from '@/mcp/servers';
import {
  deleteMcpToolSettingsForServer,
  listMcpToolSettings,
  saveMcpToolSetting,
} from '@/mcp/settings';
import {
  flattenRecentHistoryToTranscript,
  OWNER_MEMORY_CONSOLIDATION_CRON,
} from '@/memory/consolidate';
import { runOwnerMemoryConsolidation } from '@/memory/nightly';
import { deletePendingDeviceMessage, listPendingDeviceMessages } from '@/memory/pending';
import {
  createApolloSessionManager,
  LEGACY_THREAD_SESSION_ID,
  rememberFactInSession,
} from '@/memory/session';
import {
  addMemoryRecord,
  getSessionPreference,
  setSessionPreference,
  type MemorySqlExecutor,
  type MemorySqlRow,
} from '@/memory/store';
import { embedTextWithOpenRouter, queryMemoryVectors } from '@/memory/vector';
import { PUBLIC_ORIGIN_PREFERENCE_KEY, runFirmwareLifecycle } from '@/ota/lifecycle';
import { enqueueMemoryIndexJob } from '@/queues/consume';
import { cycleDeskSpeechMode, resolveDeskSpeechMode } from '@/persona/catalog';
import { resolveDeskFaceEmotion } from '@/persona/face';
import { APOLLO_TTS_VOICE } from '@/persona/soul';
import {
  encodeServerToDeviceMessage,
  parseDeviceToServerMessage,
  type ConfirmCloseReasonName,
  type DeskSoundEffectName,
  type DeviceToServerMessage,
  type ServerToDeviceMessage,
} from '@/protocol/schema';
import {
  mapAgentScheduleListToReminderList,
  selectReminderRowsForCancel,
  type ScheduledReminderRow,
} from '@/reminders/logic';
import { createDeskUiMachine, type DeskUiMachine } from '@/session/machine';
import {
  evaluateLowBatteryAnnouncement,
  parseStoredTelemetrySnapshot,
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';
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
import {
  deletePendingToolConfirmations,
  isPendingConfirmationOrphaned,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';
import type {
  DeskToolEffects,
  PendingToolConfirmation,
  ToolDefinition,
  ToolExecutionResult,
} from '@/tools/types';
import { chatWithOpenRouter } from '@/voice/llm';
import { geocodeDeskWeatherLocation, type DeskWeatherLocation } from '@/weather/geocode';
import type { DeskWeatherSnapshot } from '@/weather/fetch';
import {
  resolveDeskWeatherLocationFromPreferences,
  serializeWeatherLocation,
  WEATHER_LOCATION_PREFERENCE_KEY,
} from '@/weather/location';

// A quarter second of 16 kHz mono 16-bit PCM. Below this there is no word to
// transcribe, only the tail of a press that ended too early.
const MINIMUM_TURN_AUDIO_BYTE_LENGTH = 8000;

const LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY = 'lowBatteryLastAnnounceAt';
const TELEMETRY_SNAPSHOT_PREFERENCE_KEY = 'lastTelemetrySnapshot';
const INITIATIVE_STATE_PREFERENCE_KEY = 'initiativeState';

type McpSecretInput = z.infer<typeof mcpSecretInputSchema>;
type RemoveMcpServerInput = z.infer<typeof removeMcpServerInputSchema>;
type RetryMcpServerInput = z.infer<typeof retryMcpServerInputSchema>;
type ConsoleSecretInput = z.infer<typeof consoleSecretInputSchema>;
type ConsoleMemoryBrowseInput = z.infer<typeof consoleMemoryBrowseInputSchema>;
type ConsoleCancelReminderInput = z.infer<typeof consoleCancelReminderInputSchema>;
type ConsoleCreateReminderInput = z.infer<typeof consoleCreateReminderInputSchema>;
type ConsoleBroadcastTextInput = z.infer<typeof consoleBroadcastTextInputSchema>;
type ConsoleBroadcastUploadBeginInput = z.infer<
  typeof consoleBroadcastUploadBeginInputSchema
>;
type ConsoleBroadcastUploadChunkInput = z.infer<
  typeof consoleBroadcastUploadChunkInputSchema
>;
type ConsoleBroadcastUploadCommitInput = z.infer<
  typeof consoleBroadcastUploadCommitInputSchema
>;
type ConsoleDeviceVolumeInput = z.infer<typeof consoleDeviceVolumeInputSchema>;
type ConsoleDeviceBrightnessInput = z.infer<typeof consoleDeviceBrightnessInputSchema>;
type ConsoleAddMemoryInput = z.infer<typeof consoleAddMemoryInputSchema>;
type ConsoleDeleteMemoryInput = z.infer<typeof consoleDeleteMemoryInputSchema>;
type ConsoleAddListItemInput = z.infer<typeof consoleAddListItemInputSchema>;
type ConsoleRemoveListItemInput = z.infer<typeof consoleRemoveListItemInputSchema>;
type ConsoleWeatherInput = z.infer<typeof consoleWeatherInputSchema>;
type ConsoleThreadListInput = z.infer<typeof consoleThreadListInputSchema>;
type ConsoleThreadInput = z.infer<typeof consoleThreadInputSchema>;
type ConsoleDocumentInput = z.infer<typeof consoleDocumentInputSchema>;
type ConsoleSpeechModeInput = z.infer<typeof consoleSpeechModeInputSchema>;
type NotifyBackgroundResultInput = z.infer<typeof notifyBackgroundResultInputSchema>;
type DeliverReminderPayload = z.infer<typeof deliverReminderPayloadSchema>;
type ExpireConfirmPayload = z.infer<typeof expireConfirmPayloadSchema>;
type RetryInitiativeUtterancePayload = z.infer<
  typeof retryInitiativeUtterancePayloadSchema
>;
type FinalizeThreadPayload = z.infer<typeof finalizeThreadPayloadSchema>;

type DeviceToolArgumentRecord = Parameters<typeof buildDeviceToolCallPayload>[2];
type UiStatePushMessage = Extract<ServerToDeviceMessage, { type: 'ui_state' }>;

function createDurableObjectSqlExecutor(sqlStorage: SqlStorage): MemorySqlExecutor {
  function executeMemorySqlQuery<Row extends MemorySqlRow>(
    query: string,
    ...bindValues: unknown[]
  ): readonly Row[];
  function executeMemorySqlQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    return sqlStorage.exec(query, ...bindValues).toArray();
  }
  return { execute: executeMemorySqlQuery };
}

export type DeskUiState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'confirm'
  | 'speaking'
  | 'focus'
  | 'dashboard';

export type ApolloState = {
  readonly uiState: DeskUiState;
  readonly speechMode: string;
  readonly focusEndsAt: number | null;
  readonly focusStartedAt: number | null;
  readonly caption: string | null;
  readonly pendingConfirmId: string | null;
  readonly pendingConfirmSummary: string | null;
};

export class Apollo extends Agent<Env, ApolloState> {
  initialState: ApolloState = {
    uiState: 'idle',
    speechMode: 'default',
    focusEndsAt: null,
    focusStartedAt: null,
    caption: null,
    pendingConfirmId: null,
    pendingConfirmSummary: null,
  };

  #uiMachine: DeskUiMachine = createDeskUiMachine('idle');
  #audioChunkList: ArrayBuffer[] = [];
  #pendingConfirmation: PendingToolConfirmation | undefined;
  #didLoadPreferences = false;
  #isSpeechAborted = false;
  #sessionManager: SessionManager | undefined;
  #activeThreadSessionId: string | undefined;
  #idleThreadCheckScheduleId: string | undefined;
  #lastKnownWeatherSnapshot: DeskWeatherSnapshot | undefined;
  #lastTelemetrySnapshot: DeskTelemetrySnapshot | undefined;
  #isAnnouncingLowBattery = false;
  #isDeliveringInitiative = false;
  #isConsolidatingMemory = false;
  #deviceMcpRequestRegistry = createDeviceMcpRequestRegistry();
  #broadcastUploadSessionMap = new Map<string, BroadcastUploadSession>();
  #ttsSequence = 0;
  #lastPlaybackAck: {
    readonly sequence: number;
    readonly playedMilliseconds: number;
    readonly receivedAtMilliseconds: number;
  } | null = null;

  get sessionManager(): SessionManager {
    if (this.#sessionManager === undefined) {
      this.#sessionManager = createApolloSessionManager(this, this.env);
    }
    return this.#sessionManager;
  }

  // The active thread session; before the first post-migration turn it falls
  // back to the legacy fixed session, whose shared memory block is the same.
  get session(): Session {
    return this.sessionManager.getSession(
      this.#activeThreadSessionId ?? LEGACY_THREAD_SESSION_ID,
    );
  }

  async onStart(): Promise<void> {
    // Held in memory only, so every DO start must re-register it; without it a
    // successful OAuth callback strands the owner's browser on a bare 404.
    this.mcp.configureOAuthCallback({
      customHandler: (callbackResult) => buildMcpOauthLandingResponse(callbackResult),
    });
    void this.sql`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    void this.sql`
      CREATE TABLE IF NOT EXISTS session_prefs (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `;
    void this.sql`
      CREATE TABLE IF NOT EXISTS pending_device_messages (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    void this.sql`
      CREATE TABLE IF NOT EXISTS list_items (
        id TEXT PRIMARY KEY,
        list_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `;
    // The confirm window is idle by nature, so the agent routinely hibernates
    // mid-wait and loses the in-memory copy before the user answers.
    void this.sql`
      CREATE TABLE IF NOT EXISTS pending_confirmations (
        id TEXT PRIMARY KEY,
        tool_name TEXT NOT NULL,
        args_json TEXT NOT NULL,
        summary TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `;
    // The SDK owns the server rows in cf_agents_mcp_servers; which of their
    // tools Apollo may actually call is ours.
    void this.sql`
      CREATE TABLE IF NOT EXISTS mcp_tool_settings (
        namespaced_name TEXT PRIMARY KEY,
        server_id TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        is_enabled INTEGER NOT NULL,
        safety TEXT NOT NULL
      )
    `;
    // Thread classification and summaries live outside the SDK's session
    // tables so the SDK schema stays untouched by Apollo concerns.
    void this.sql`
      CREATE TABLE IF NOT EXISTS thread_meta (
        session_id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        summary TEXT,
        last_turn_at INTEGER NOT NULL
      )
    `;
    this.#sessionManager = createApolloSessionManager(this, this.env);
    const storedActiveThreadSessionId = await getSessionPreference(
      this.#sqlExecutor(),
      ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
    );
    if (storedActiveThreadSessionId !== null && storedActiveThreadSessionId.length > 0) {
      this.#activeThreadSessionId = storedActiveThreadSessionId;
    }
    await this.#ensurePreferencesLoaded();
    await this.scheduleEvery(
      DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
      'refreshDashboardWeather',
    );
    await this.schedule(OWNER_MEMORY_CONSOLIDATION_CRON, 'consolidateOwnerMemory');
    await this.scheduleEvery(86_400, 'purgeExpiredCommandThreads');
  }

  async purgeExpiredCommandThreads(): Promise<void> {
    const sqlExecutor = this.#sqlExecutor();
    const retentionCutoffMilliseconds =
      Date.now() - COMMAND_THREAD_RETENTION_DAYS * 86_400_000;
    const expiredSessionIdList = listExpiredCommandThreadSessionIds(
      sqlExecutor,
      retentionCutoffMilliseconds,
    );
    for (const expiredSessionId of expiredSessionIdList) {
      if (expiredSessionId === this.#activeThreadSessionId) {
        continue;
      }
      await this.sessionManager.delete(expiredSessionId);
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
  }

  async #resolveWeatherLocation() {
    return resolveDeskWeatherLocationFromPreferences(async () =>
      getSessionPreference(this.#sqlExecutor(), WEATHER_LOCATION_PREFERENCE_KEY),
    );
  }

  async refreshDashboardWeather(): Promise<void> {
    const location = await this.#resolveWeatherLocation();
    const weatherSnapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      lastKnownSnapshot: this.#lastKnownWeatherSnapshot,
    });
    if (weatherSnapshot.conditionLabel !== UNAVAILABLE_WEATHER_CONDITION_LABEL) {
      this.#lastKnownWeatherSnapshot = weatherSnapshot;
    }

    const connectionList = [...this.getConnections(DEVICE_CONNECTION_TAG)];
    if (
      !shouldPushDashboardOnWeatherRefresh({
        uiState: this.state.uiState,
        connectionCount: connectionList.length,
      })
    ) {
      return;
    }

    const dashboardPayload = await buildDeskDashboardPayload({
      timezone: location.timezone,
      weather: weatherSnapshot,
    });
    const encodedDashboardPayload = encodeServerToDeviceMessage(dashboardPayload);
    for (const connection of connectionList) {
      connection.send(encodedDashboardPayload);
    }
  }

  // Device and dashboard share one instance so they share state, but almost
  // everything the server sends is device-shaped. Tagging is what lets a
  // broadcast address the device alone.
  async getConnectionTags(
    _connection: Connection,
    connectionContext: ConnectionContext,
  ): Promise<string[]> {
    const connectionRole = await resolveApolloConnectionRole(
      new URL(connectionContext.request.url),
      this.env,
    );
    return connectionRole === null ? [] : [connectionRole];
  }

  // The SDK's own frames are not part of the Apollo protocol, and the firmware
  // answers an unrecognized frame with an error.
  shouldSendProtocolMessages(
    connection: Connection,
    _connectionContext: ConnectionContext,
  ): boolean {
    return !hasDeviceConnectionTag(connection.tags);
  }

  async onConnect(
    connection: Connection,
    connectionContext: ConnectionContext,
  ): Promise<void> {
    await this.#ensurePreferencesLoaded();
    // Everything below replays desk session state to the arriving client, and
    // the pending-message flush *consumes* what it sends. A dashboard taking
    // this path swallows a queued reminder the device never gets to announce,
    // and stamps its own browser origin over the one OTA hands the device.
    if (!hasDeviceConnectionTag(connection.tags)) {
      return;
    }
    // The DO has no ambient request origin, and the OTA push must hand the
    // device a URL it can reach — the connection that just arrived proves this
    // origin works, so it is captured here instead of configured.
    const publicOrigin = new URL(connectionContext.request.url).origin;
    const storedPublicOrigin = await getSessionPreference(
      this.#sqlExecutor(),
      PUBLIC_ORIGIN_PREFERENCE_KEY,
    );
    if (storedPublicOrigin !== publicOrigin) {
      await setSessionPreference(
        this.#sqlExecutor(),
        PUBLIC_ORIGIN_PREFERENCE_KEY,
        publicOrigin,
      );
    }
    // A caption describes the turn that produced it, not the session. Left in
    // durable state, a failure message greets the user on every reconnect long
    // after the turn that failed.
    if (this.state.caption !== null) {
      this.setState({ ...this.state, caption: null });
    }
    this.#pushUiState(connection);
    await this.#pushDashboard(connection);
    await this.#flushPendingDeviceMessages(connection);
  }

  async onMessage(connection: Connection, message: WSMessage): Promise<void> {
    // Everything below this line is the device protocol: mic audio, the listen
    // state machine, telemetry that steers OTA, MCP replies that resolve a
    // pending device tool call, and confirm answers to a prompt on the device's
    // own screen. None of it means anything from a browser, and honoring it
    // would let one desynchronize the desk. The SDK dispatches @callable RPC
    // and state sync before this runs, so the dashboard keeps both.
    if (!hasDeviceConnectionTag(connection.tags)) {
      return;
    }

    if (message instanceof ArrayBuffer) {
      this.#audioChunkList.push(message);
      return;
    }
    if (ArrayBuffer.isView(message)) {
      const audioChunkBuffer = new ArrayBuffer(message.byteLength);
      new Uint8Array(audioChunkBuffer).set(
        new Uint8Array(message.buffer, message.byteOffset, message.byteLength),
      );
      this.#audioChunkList.push(audioChunkBuffer);
      return;
    }

    let deviceMessage: DeviceToServerMessage;
    try {
      deviceMessage = parseDeviceToServerMessage(message);
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
        this.#pushUiState(connection);
        break;
      }
      case 'hold_start':
      case 'wake': {
        this.#audioChunkList = [];
        this.#applyUiEvent('START_LISTEN');
        // Whatever the previous turn left on screen is stale the moment a new
        // one starts, including an error from a turn the user has moved on from.
        this.setState({ ...this.state, caption: null });
        this.#pushUiState(connection);
        break;
      }
      case 'hold_end': {
        await this.#runTurnFromAudio(connection);
        break;
      }
      case 'audio_end': {
        await this.#runTurnFromAudio(connection);
        break;
      }
      case 'listen_cancel': {
        this.#audioChunkList = [];
        this.#applyUiEvent('CANCEL');
        this.#pushUiState(connection);
        break;
      }
      case 'text_input': {
        await this.#runTurnFromText(connection, deviceMessage.text);
        break;
      }
      case 'abort': {
        // Only a flag: the paced TTS loop is awaiting between chunks, so it
        // picks this up on its next turn and stops sending.
        this.#isSpeechAborted = true;
        break;
      }
      case 'confirm': {
        await this.#resolveConfirm(connection, deviceMessage.ok);
        break;
      }
      case 'gesture': {
        await this.#handleGesture(connection, deviceMessage.gesture);
        break;
      }
      case 'telemetry': {
        await this.#handleTelemetry(deviceMessage);
        break;
      }
      case 'mcp': {
        this.#deviceMcpRequestRegistry.resolvePendingRequest(deviceMessage.payload);
        break;
      }
      case 'playback_ack': {
        this.#lastPlaybackAck = {
          sequence: deviceMessage.sequence,
          playedMilliseconds: deviceMessage.playedMilliseconds,
          receivedAtMilliseconds: Date.now(),
        };
        break;
      }
    }
  }

  @callable()
  async confirmAction(isApproved: boolean): Promise<ApolloState> {
    const connection = [...this.getConnections(DEVICE_CONNECTION_TAG)][0];
    if (connection === undefined) {
      return this.state;
    }
    await this.#resolveConfirm(connection, isApproved);
    return this.state;
  }

  // A @callable method cannot tell which connection invoked it, so connect-time
  // authorization is re-checked here: otherwise anything holding a socket could
  // install a server and grant itself tools.
  async #assertDashboardSecret(presentedSecret: string): Promise<void> {
    const isAuthorized = await isDeviceSharedSecretValid(
      presentedSecret,
      this.env.DASHBOARD_SHARED_SECRET,
    );
    if (!isAuthorized) {
      throw new Error('Unauthorized');
    }
  }

  async #listMcpServerSummaryList(): Promise<readonly McpServerSummary[]> {
    const [discoveredToolList, settingList] = await Promise.all([
      discoverInstalledMcpToolList(this.mcp),
      listMcpToolSettings(this.#sqlExecutor()),
    ]);
    return buildInstalledMcpServerSummaryList({
      serverRecordMap: this.getMcpServers().servers,
      discoveredToolList,
      settingList,
    });
  }

  @callable()
  async installMcpServer(rawInput: InstallMcpServerInput): Promise<{
    readonly serverId: string;
    readonly state: string;
    readonly authUrl: string | null;
  }> {
    const input = installMcpServerInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    // Without an explicit callbackHost the SDK derives it from this very
    // connection's host, which is the worker origin the console dialed.
    const installResult = await this.addMcpServer(
      input.name,
      input.url,
      input.authToken === undefined
        ? undefined
        : {
            transport: { headers: { Authorization: `Bearer ${input.authToken}` } },
          },
    );
    return {
      serverId: installResult.id,
      state: installResult.state,
      authUrl: 'authUrl' in installResult ? installResult.authUrl : null,
    };
  }

  @callable()
  async uninstallMcpServer(
    rawInput: RemoveMcpServerInput,
  ): Promise<readonly McpServerSummary[]> {
    const input = removeMcpServerInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await this.removeMcpServer(input.serverId);
    await deleteMcpToolSettingsForServer(this.#sqlExecutor(), input.serverId);
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async listMcpServers(rawInput: McpSecretInput): Promise<readonly McpServerSummary[]> {
    const input = mcpSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async retryMcpServer(
    rawInput: RetryMcpServerInput,
  ): Promise<readonly McpServerSummary[]> {
    const input = retryMcpServerInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    // Reconnects the existing installation with its stored transport — auth
    // provider and headers included — instead of re-running install, which
    // rejects failed servers and would drop a token-authenticated setup.
    await this.mcp.connectToServer(input.serverId);
    await this.mcp.discoverIfConnected(input.serverId);
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async enableMcpTool(
    rawInput: SetMcpToolEnabledInput,
  ): Promise<readonly McpServerSummary[]> {
    return this.#setMcpToolEnabled(rawInput, true);
  }

  @callable()
  async disableMcpTool(
    rawInput: SetMcpToolEnabledInput,
  ): Promise<readonly McpServerSummary[]> {
    return this.#setMcpToolEnabled(rawInput, false);
  }

  async #setMcpToolEnabled(
    rawInput: SetMcpToolEnabledInput,
    isEnabled: boolean,
  ): Promise<readonly McpServerSummary[]> {
    const input = setMcpToolEnabledInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const discoveredTool = (await discoverInstalledMcpToolList(this.mcp)).find(
      (candidate) =>
        candidate.serverId === input.serverId && candidate.name === input.toolName,
    );
    // Disabling must work while the server is unreachable — that is exactly when
    // the owner reaches for it.
    if (isEnabled && discoveredTool === undefined) {
      throw new Error(`Unknown MCP tool: ${input.serverId}/${input.toolName}`);
    }
    const resolvedSafety =
      input.safety ??
      (discoveredTool === undefined
        ? 'unsafe'
        : resolveDiscoveredMcpToolSafety(discoveredTool));
    await saveMcpToolSetting(this.#sqlExecutor(), {
      namespacedName: buildNamespacedMcpToolName(input.serverId, input.toolName),
      serverId: input.serverId,
      toolName: input.toolName,
      isEnabled,
      safety: resolvedSafety,
    });
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async getConsoleStatus(rawInput: ConsoleSecretInput): Promise<ConsoleStatusSnapshot> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await this.#ensureTelemetrySnapshotLoaded();
    const reminderList = await this.#listConsoleReminderRowList();
    return buildConsoleStatusSnapshot({
      deviceConnectionCount: [...this.getConnections(DEVICE_CONNECTION_TAG)].length,
      telemetrySnapshot: this.#lastTelemetrySnapshot,
      pendingReminderCount: reminderList.length,
      nowMilliseconds: Date.now(),
    });
  }

  @callable()
  async browseConsoleMemory(
    rawInput: ConsoleMemoryBrowseInput,
  ): Promise<ConsoleMemoryBrowseResult> {
    const input = consoleMemoryBrowseInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return browseConsoleMemoryRecords(this.#sqlExecutor(), {
      query: input.query,
      limit: input.limit,
    });
  }

  @callable()
  async listConsoleLists(
    rawInput: ConsoleSecretInput,
  ): Promise<readonly ListItemRecord[]> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return listListItemRecords(this.#sqlExecutor());
  }

  @callable()
  async listConsoleReminders(
    rawInput: ConsoleSecretInput,
  ): Promise<readonly ScheduledReminderRow[]> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#listConsoleReminderRowList();
  }

  @callable()
  async cancelConsoleReminder(
    rawInput: ConsoleCancelReminderInput,
  ): Promise<readonly ScheduledReminderRow[]> {
    const input = consoleCancelReminderInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await this.cancelSchedule(input.reminderId);
    await this.#broadcastSoonestRemainingTimerArc();
    return this.#listConsoleReminderRowList();
  }

  async #listConsoleReminderRowList(): Promise<readonly ScheduledReminderRow[]> {
    return mapAgentScheduleListToReminderList(await this.listSchedules());
  }

  @callable()
  async createConsoleReminder(
    rawInput: ConsoleCreateReminderInput,
  ): Promise<readonly ScheduledReminderRow[]> {
    const input = consoleCreateReminderInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    // Timers are recognized downstream by the "Timer" message prefix plus a
    // numeric delay, so the console reuses the voice tool's message shape.
    const message =
      input.isTimer === true ? `Timer terminado: ${input.message}.` : input.message;
    await this.schedule(input.delaySeconds, 'deliverReminder', { message });
    if (input.isTimer === true) {
      this.#broadcastTimerArc({
        endsAtEpochSeconds: Math.floor(Date.now() / 1000) + input.delaySeconds,
        durationSeconds: input.delaySeconds,
      });
    }
    return this.#listConsoleReminderRowList();
  }

  @callable()
  async sendConsoleBroadcastText(
    rawInput: ConsoleBroadcastTextInput,
  ): Promise<{ readonly outcome: BroadcastDeliveryOutcome }> {
    const input = consoleBroadcastTextInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const outcome = await deliverBroadcastText({
      message: input.message,
      connectionList: [...this.getConnections(DEVICE_CONNECTION_TAG)],
      sqlExecutor: this.#sqlExecutor(),
      environment: this.env,
      ttsVoiceId: APOLLO_TTS_VOICE,
      isMockVoice: this.env.MOCK_VOICE === '1',
      playChimeEffect: () => this.#broadcastPlayEffect('chime'),
    });
    return { outcome };
  }

  @callable()
  async beginConsoleBroadcastAudioUpload(
    rawInput: ConsoleBroadcastUploadBeginInput,
  ): Promise<{ readonly uploadId: string }> {
    const input = consoleBroadcastUploadBeginInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    this.#evictExpiredBroadcastUploadSessions();
    const uploadId = crypto.randomUUID();
    this.#broadcastUploadSessionMap.set(
      uploadId,
      createBroadcastUploadSession({
        totalBytes: input.totalBytes,
        expectedChunkCount: input.chunkCount,
        nowMilliseconds: Date.now(),
      }),
    );
    return { uploadId };
  }

  @callable()
  async appendConsoleBroadcastAudioChunk(
    rawInput: ConsoleBroadcastUploadChunkInput,
  ): Promise<{ readonly receivedChunkCount: number }> {
    const input = consoleBroadcastUploadChunkInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const uploadSession = this.#requireBroadcastUploadSession(input.uploadId);
    const receivedChunkCount = appendBroadcastUploadChunk(
      uploadSession,
      input.chunkIndex,
      input.base64Chunk,
    );
    return { receivedChunkCount };
  }

  @callable()
  async commitConsoleBroadcastAudioUpload(
    rawInput: ConsoleBroadcastUploadCommitInput,
  ): Promise<{ readonly outcome: BroadcastDeliveryOutcome }> {
    const input = consoleBroadcastUploadCommitInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const uploadSession = this.#requireBroadcastUploadSession(input.uploadId);
    const audioBuffer = assembleBroadcastUploadAudio(uploadSession);
    this.#broadcastUploadSessionMap.delete(input.uploadId);
    const outcome = await deliverBroadcastAudio({
      audioBuffer,
      broadcastId: crypto.randomUUID(),
      connectionList: [...this.getConnections(DEVICE_CONNECTION_TAG)],
      sqlExecutor: this.#sqlExecutor(),
      mediaBucket: this.env.MEDIA,
      playChimeEffect: () => this.#broadcastPlayEffect('chime'),
    });
    return { outcome };
  }

  #requireBroadcastUploadSession(uploadId: string): BroadcastUploadSession {
    const uploadSession = this.#broadcastUploadSessionMap.get(uploadId);
    if (uploadSession === undefined) {
      // The map is in-memory: a Durable Object restart mid-upload loses it and
      // the console has to start the upload over from the first chunk.
      throw new Error('La subida expiró; volvé a enviar el audio');
    }
    return uploadSession;
  }

  #evictExpiredBroadcastUploadSessions(): void {
    const nowMilliseconds = Date.now();
    for (const [uploadId, uploadSession] of this.#broadcastUploadSessionMap) {
      if (isBroadcastUploadSessionExpired(uploadSession, nowMilliseconds)) {
        this.#broadcastUploadSessionMap.delete(uploadId);
      }
    }
  }

  @callable()
  async setConsoleDeviceVolume(
    rawInput: ConsoleDeviceVolumeInput,
  ): Promise<ToolExecutionResult> {
    const input = consoleDeviceVolumeInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#callDeviceTool('self.audio_speaker.set_volume', {
      volume: input.volume,
    });
  }

  @callable()
  async setConsoleDeviceBrightness(
    rawInput: ConsoleDeviceBrightnessInput,
  ): Promise<ToolExecutionResult> {
    const input = consoleDeviceBrightnessInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#callDeviceTool('self.screen.set_brightness', {
      brightness: input.brightness,
    });
  }

  @callable()
  async getConsoleDeviceStatus(
    rawInput: ConsoleSecretInput,
  ): Promise<ToolExecutionResult> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#callDeviceTool('self.get_device_status', {});
  }

  @callable()
  async addConsoleMemory(
    rawInput: ConsoleAddMemoryInput,
  ): Promise<ConsoleMemoryBrowseResult> {
    const input = consoleAddMemoryInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const memoryRecord = await addMemoryRecord(this.#sqlExecutor(), input.content);
    await rememberFactInSession(this.session, input.content);
    await enqueueMemoryIndexJob(this.env, {
      memoryId: memoryRecord.id,
      content: input.content,
      deviceId: this.name ?? 'default',
    });
    return browseConsoleMemoryRecords(this.#sqlExecutor(), {});
  }

  @callable()
  async deleteConsoleMemory(
    rawInput: ConsoleDeleteMemoryInput,
  ): Promise<ConsoleMemoryBrowseResult> {
    const input = consoleDeleteMemoryInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await deleteConsoleMemoryRecord(
      this.#sqlExecutor(),
      this.env.VECTORIZE,
      input.memoryId,
    );
    return browseConsoleMemoryRecords(this.#sqlExecutor(), {});
  }

  @callable()
  async addConsoleListItem(
    rawInput: ConsoleAddListItemInput,
  ): Promise<readonly ListItemRecord[]> {
    const input = consoleAddListItemInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await addListItemRecord(this.#sqlExecutor(), {
      listName: input.listName,
      content: input.content,
    });
    return listListItemRecords(this.#sqlExecutor());
  }

  @callable()
  async removeConsoleListItem(
    rawInput: ConsoleRemoveListItemInput,
  ): Promise<readonly ListItemRecord[]> {
    const input = consoleRemoveListItemInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await removeListItemRecordById(this.#sqlExecutor(), input.itemId);
    return listListItemRecords(this.#sqlExecutor());
  }

  @callable()
  async getConsoleWeather(rawInput: ConsoleSecretInput): Promise<DeskWeatherLocation> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#resolveWeatherLocation();
  }

  @callable()
  async setConsoleWeather(rawInput: ConsoleWeatherInput): Promise<DeskWeatherLocation> {
    const input = consoleWeatherInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const location = await geocodeDeskWeatherLocation({
      locationQuery: input.locationQuery,
    });
    await setSessionPreference(
      this.#sqlExecutor(),
      WEATHER_LOCATION_PREFERENCE_KEY,
      serializeWeatherLocation(location),
    );
    await this.refreshDashboardWeather();
    return location;
  }

  @callable()
  async listConsoleThreads(
    rawInput: ConsoleThreadListInput,
  ): Promise<readonly ConsoleThreadSummary[]> {
    const input = consoleThreadListInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const legacyMessageCount = await this.sessionManager.getMessageCount(
      LEGACY_THREAD_SESSION_ID,
    );
    return mapThreadCatalogToConsoleThreadList({
      sessionInfoList: this.sessionManager.list(),
      threadMetaList: listThreadMeta(this.#sqlExecutor()),
      activeThreadSessionId: this.#activeThreadSessionId ?? null,
      hasLegacyHistory: legacyMessageCount > 0,
      legacySessionId: LEGACY_THREAD_SESSION_ID,
    });
  }

  @callable()
  async getConsoleThread(
    rawInput: ConsoleThreadInput,
  ): Promise<readonly ConsoleHistoryTurn[]> {
    const input = consoleThreadInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const recentHistory = await this.sessionManager
      .getSession(input.threadId)
      .getRecentHistory(input.maxContentBytes ?? 48_000, 10);
    return mapSessionMessagesToConsoleHistory(recentHistory.messages);
  }

  @callable()
  async listConsoleJobs(
    rawInput: ConsoleSecretInput,
  ): Promise<readonly ConsoleJobDocument[]> {
    const input = consoleSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return listConsoleJobDocuments(this.env.MEDIA, this.name ?? 'default');
  }

  @callable()
  async getConsoleDocument(rawInput: ConsoleDocumentInput): Promise<{
    readonly documentKey: string;
    readonly content: string | null;
  }> {
    const input = consoleDocumentInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const content = await readConsoleJobDocument(
      this.env.MEDIA,
      this.name ?? 'default',
      input.documentKey,
    );
    return { documentKey: input.documentKey, content };
  }

  @callable()
  async setConsoleSpeechMode(rawInput: ConsoleSpeechModeInput): Promise<ApolloState> {
    const input = consoleSpeechModeInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.setSpeechMode(input.speechModeId);
  }

  @callable()
  async setSpeechMode(speechModeId: string): Promise<ApolloState> {
    const speechMode = resolveDeskSpeechMode(speechModeId);
    await setSessionPreference(this.#sqlExecutor(), 'speechMode', speechMode.id);
    this.setState({
      ...this.state,
      speechMode: speechMode.id,
      caption: null,
    });
    // The desk only learns the new accent from a ui_state push; without it the
    // ring keeps the old mode color until an unrelated event redraws it.
    for (const connection of this.getConnections(DEVICE_CONNECTION_TAG)) {
      this.#pushUiState(connection);
    }
    return this.state;
  }

  async expireConfirm(payload: ExpireConfirmPayload | undefined): Promise<void> {
    if (this.state.pendingConfirmId === null) {
      return;
    }
    // Timers scheduled before this payload existed still fire with `undefined`,
    // so an unreadable payload falls back to the stored expiry. A resolved
    // confirmation otherwise leaves its timer behind, and matching on the id
    // stops it cancelling whichever confirmation is live by then.
    const parsedPayload = expireConfirmPayloadSchema.safeParse(payload);
    if (parsedPayload.success) {
      if (this.state.pendingConfirmId !== parsedPayload.data.confirmationId) {
        return;
      }
    } else {
      const storedConfirmation = await readPendingToolConfirmation(this.#sqlExecutor());
      if (storedConfirmation !== undefined && storedConfirmation.expiresAt > Date.now()) {
        return;
      }
    }
    await this.#closePendingConfirmation('Confirmación expirada', 'expired');
  }

  // Closing a confirmation is the same work however it ends: forget it in
  // memory and on disk, leave the confirm UI state, and tell the device — which
  // is sitting on the confirm screen and never learns the window closed unless
  // it is told.
  async #closePendingConfirmation(
    caption: string,
    reason: 'expired' | 'orphaned',
  ): Promise<void> {
    const closingConfirmId =
      this.state.pendingConfirmId ?? this.#pendingConfirmation?.id ?? null;
    if (closingConfirmId !== null) {
      this.#broadcastConfirmClose(closingConfirmId, reason);
    }
    this.#pendingConfirmation = undefined;
    await deletePendingToolConfirmations(this.#sqlExecutor());
    this.#applyUiEvent('CANCEL');
    this.setState({
      ...this.state,
      pendingConfirmId: null,
      pendingConfirmSummary: null,
      caption,
      uiState: this.#uiMachine.state,
    });
    for (const connection of this.getConnections(DEVICE_CONNECTION_TAG)) {
      this.#pushUiState(connection);
    }
  }

  async deliverReminder(payload: DeliverReminderPayload): Promise<void> {
    const parsedPayload = deliverReminderPayloadSchema.parse(payload);
    // The earcon goes out before the notification so it lands while the TTS
    // announcement is still being synthesized.
    this.#broadcastPlayEffect('ding');
    await deliverDeskDeviceNotification({
      notification: { type: 'reminder', message: parsedPayload.message },
      connectionList: [...this.getConnections(DEVICE_CONNECTION_TAG)],
      sqlExecutor: this.#sqlExecutor(),
      focusState: this.#currentFocusState(),
      environment: this.env,
      deviceId: this.name ?? 'default',
      ttsVoiceId: APOLLO_TTS_VOICE,
      isMockVoice: this.env.MOCK_VOICE === '1',
    });
  }

  @callable()
  async notifyBackgroundResult(input: NotifyBackgroundResultInput): Promise<void> {
    const parsedInput = notifyBackgroundResultInputSchema.parse(input);
    await deliverDeskDeviceNotification({
      notification: {
        type: 'background_result',
        prompt: parsedInput.prompt,
        summary: parsedInput.summary,
        documentKey: parsedInput.documentKey,
      },
      connectionList: [...this.getConnections(DEVICE_CONNECTION_TAG)],
      sqlExecutor: this.#sqlExecutor(),
      focusState: this.#currentFocusState(),
      environment: this.env,
      deviceId: this.name ?? 'default',
      ttsVoiceId: APOLLO_TTS_VOICE,
      isMockVoice: this.env.MOCK_VOICE === '1',
    });
  }

  // The single chokepoint for self-initiated speech (roadmap item 17): every
  // source of proactive utterances goes through the initiative policy so quiet
  // hours, focus, and the daily budget are enforced in exactly one place.
  async #deliverInitiativeUtterance(
    input: InitiativeUtteranceInput,
  ): Promise<InitiativeDeliveryOutcome> {
    const nowMilliseconds = Date.now();
    const storedInitiativeState = await getSessionPreference(
      this.#sqlExecutor(),
      INITIATIVE_STATE_PREFERENCE_KEY,
    );
    const initiativeState =
      storedInitiativeState === null
        ? undefined
        : parseStoredInitiativeState(storedInitiativeState);
    const deferCount = input.deferCount ?? 0;
    const decision = evaluateInitiativeCandidate({
      source: input.source,
      priority: input.priority,
      state: initiativeState,
      nowMilliseconds,
      focusEndsAtMilliseconds: this.state.focusEndsAt,
      connectionCount: [...this.getConnections(DEVICE_CONNECTION_TAG)].length,
      deferCount,
    });
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'initiative_decision',
        source: input.source,
        action: decision.action,
        reason: decision.action === 'deliver' ? undefined : decision.reason,
      }),
    );
    if (decision.action === 'defer') {
      const retryDelaySeconds = Math.max(
        60,
        Math.ceil((decision.retryAtMilliseconds - nowMilliseconds) / 1000),
      );
      const deferredRetryPayload: RetryInitiativeUtterancePayload = {
        source: input.source,
        priority: input.priority,
        message: input.message,
        earconName: input.earconName,
        utteranceKey: input.utteranceKey,
        deferCount,
      };
      await this.schedule(
        retryDelaySeconds,
        'retryInitiativeUtterance',
        deferredRetryPayload,
      );
      return 'deferred';
    }
    if (decision.action === 'suppress' || this.#isDeliveringInitiative) {
      return 'suppressed';
    }
    this.#isDeliveringInitiative = true;
    try {
      if (input.earconName !== undefined) {
        this.#broadcastPlayEffect(input.earconName);
      }
      await deliverDeskDeviceNotification({
        notification: { type: 'reminder', message: input.message },
        connectionList: [...this.getConnections(DEVICE_CONNECTION_TAG)],
        sqlExecutor: this.#sqlExecutor(),
        focusState: this.#currentFocusState(),
        environment: this.env,
        deviceId: this.name ?? 'default',
        ttsVoiceId: APOLLO_TTS_VOICE,
        isMockVoice: this.env.MOCK_VOICE === '1',
        announceKind: input.priority === 'critical' ? 'critical' : undefined,
      });
      // Recorded only after delivery succeeds, so a failed delivery neither
      // consumes budget nor starts the source cooldown.
      await setSessionPreference(
        this.#sqlExecutor(),
        INITIATIVE_STATE_PREFERENCE_KEY,
        JSON.stringify(
          recordInitiativeDelivery(
            initiativeState,
            input.source,
            input.priority,
            nowMilliseconds,
          ),
        ),
      );
      if (input.utteranceKey !== undefined) {
        await setSessionPreference(
          this.#sqlExecutor(),
          buildInitiativeDeliveryMarkerKey(input.utteranceKey),
          String(nowMilliseconds),
        );
      }
    } finally {
      this.#isDeliveringInitiative = false;
    }
    return 'delivered';
  }

  async retryInitiativeUtterance(
    payload: RetryInitiativeUtterancePayload,
  ): Promise<void> {
    const parsedPayload = retryInitiativeUtterancePayloadSchema.parse(payload);
    const nextDeferCount = parsedPayload.deferCount + 1;
    const retryPayload: RetryInitiativeUtterancePayload = {
      source: parsedPayload.source,
      priority: parsedPayload.priority,
      message: parsedPayload.message,
      earconName: parsedPayload.earconName,
      utteranceKey: parsedPayload.utteranceKey,
      deferCount: nextDeferCount,
    };
    const deliveryOutcome = await this.#deliverInitiativeUtterance(retryPayload);
    // A deferred utterance already survived one policy window; letting its
    // retry vanish on a transient suppression (device offline at 09:00, budget
    // spent) would lose it for good — so it re-schedules itself, bounded by
    // the attempt cap.
    if (
      deliveryOutcome === 'suppressed' &&
      nextDeferCount < INITIATIVE_MAX_RETRY_ATTEMPTS
    ) {
      await this.schedule(
        INITIATIVE_SUPPRESSED_RETRY_DELAY_SECONDS,
        'retryInitiativeUtterance',
        retryPayload,
      );
    }
  }

  async consolidateOwnerMemory(): Promise<void> {
    // Mock mode has no LLM to call; a dev session must not burn tokens.
    if (this.env.MOCK_VOICE === '1') {
      return;
    }
    if (this.#isConsolidatingMemory) {
      return;
    }
    this.#isConsolidatingMemory = true;
    try {
      await runOwnerMemoryConsolidation({
        sqlExecutor: this.#sqlExecutor(),
        session: this.session,
        environment: this.env,
        deviceId: this.name ?? 'default',
        nowMilliseconds: Date.now(),
        createIdentifier: () => crypto.randomUUID(),
        gatherTranscriptSince: async (sinceMilliseconds, transcriptByteBudget) =>
          this.#gatherThreadTranscriptSince(sinceMilliseconds, transcriptByteBudget),
      });
    } finally {
      this.#isConsolidatingMemory = false;
    }
  }

  async #gatherThreadTranscriptSince(
    sinceMilliseconds: number,
    transcriptByteBudget: number,
  ): Promise<{ readonly transcriptText: string; readonly hasNewActivity: boolean }> {
    const activeThreadSessionIdList = listThreadSessionIdsActiveSince(
      this.#sqlExecutor(),
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
      const recentHistory = await this.sessionManager
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

  async #rotateThreadForTurn(): Promise<void> {
    const sqlExecutor = this.#sqlExecutor();
    const nowMilliseconds = Date.now();
    const storedLastTurnAt = await getSessionPreference(
      sqlExecutor,
      ACTIVE_THREAD_LAST_TURN_PREFERENCE_KEY,
    );
    const rotationDecision = decideThreadRotation({
      activeSessionId: this.#activeThreadSessionId ?? null,
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
      const threadInfo = this.sessionManager.create(
        buildDefaultThreadTitle(nowMilliseconds),
        { source: 'voice' },
      );
      activeThreadSessionId = threadInfo.id;
      this.#activeThreadSessionId = threadInfo.id;
      await setSessionPreference(
        sqlExecutor,
        ACTIVE_THREAD_SESSION_PREFERENCE_KEY,
        threadInfo.id,
      );
      await setSessionPreference(sqlExecutor, PREVIOUS_THREAD_SESSION_PREFERENCE_KEY, '');
      if (handoffSourceSessionId !== null) {
        await this.#writeThreadHandoffNote(handoffSourceSessionId, threadInfo.id);
      }
      if (rotationDecision.previousSessionId !== null) {
        await this.schedule(1, 'finalizeThread', {
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
    await this.#scheduleIdleThreadCheck();
  }

  // Best effort: the id lives in memory only, so a hibernation between turns
  // leaks at most one extra check, and maybeFinalizeIdleThread is idempotent.
  async #scheduleIdleThreadCheck(): Promise<void> {
    if (this.#idleThreadCheckScheduleId !== undefined) {
      await this.cancelSchedule(this.#idleThreadCheckScheduleId);
    }
    const idleCheckDelaySeconds =
      Math.ceil(THREAD_INACTIVITY_CUTOFF_MILLISECONDS / 1000) + 60;
    const idleCheckSchedule = await this.schedule(
      idleCheckDelaySeconds,
      'maybeFinalizeIdleThread',
      {},
    );
    this.#idleThreadCheckScheduleId = idleCheckSchedule.id;
  }

  async maybeFinalizeIdleThread(): Promise<void> {
    const sqlExecutor = this.#sqlExecutor();
    const activeThreadSessionId = this.#activeThreadSessionId;
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
    this.#activeThreadSessionId = undefined;
    await setSessionPreference(sqlExecutor, ACTIVE_THREAD_SESSION_PREFERENCE_KEY, '');
    await setSessionPreference(
      sqlExecutor,
      PREVIOUS_THREAD_SESSION_PREFERENCE_KEY,
      activeThreadSessionId,
    );
    await this.finalizeThread({ sessionId: activeThreadSessionId });
  }

  // Reopening makes the found thread active again: its recency window feeds
  // the next turn, and its meta drops back to pending so the next close
  // regenerates a digest that covers the new turns. The turn that triggered
  // the resume still lands in the thread it started in.
  async #resumeConversationThread(
    query: string,
  ): Promise<{ readonly title: string; readonly summary: string | null } | undefined> {
    const sqlExecutor = this.#sqlExecutor();
    const resolvedSessionId =
      (await this.#findThreadByVector(query)) ?? this.#findThreadByKeyword(query);
    if (resolvedSessionId === undefined) {
      return undefined;
    }
    const threadInfo = this.sessionManager.get(resolvedSessionId);
    if (threadInfo === null) {
      return undefined;
    }
    const threadMeta = getThreadMeta(sqlExecutor, resolvedSessionId);
    const nowMilliseconds = Date.now();
    this.#activeThreadSessionId = resolvedSessionId;
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
    await this.#scheduleIdleThreadCheck();
    return { title: threadInfo.name, summary: threadMeta?.summary ?? null };
  }

  async #findThreadByVector(query: string): Promise<string | undefined> {
    // Mock mode has no embeddings; the keyword fallback still works.
    if (this.env.MOCK_VOICE === '1') {
      return undefined;
    }
    try {
      const values = await embedTextWithOpenRouter({
        openRouterApiKey: this.env.OPENROUTER_API_KEY,
        modelId: this.env.OPENROUTER_EMBEDDING_MODEL,
        text: query,
      });
      const matchList = await queryMemoryVectors({
        vectorizeIndex: this.env.VECTORIZE,
        values,
        deviceId: this.name ?? 'default',
        topK: 8,
      });
      for (const match of matchList) {
        const sessionId = mapVectorMemoryIdToThreadSessionId(match.id);
        if (
          sessionId !== undefined &&
          sessionId !== this.#activeThreadSessionId &&
          this.sessionManager.get(sessionId) !== null
        ) {
          return sessionId;
        }
      }
    } catch {
      // Resume must never fail the turn; the keyword fallback runs next.
    }
    return undefined;
  }

  #findThreadByKeyword(query: string): string | undefined {
    const metaBySessionId = new Map(
      listThreadMeta(this.#sqlExecutor()).map((meta) => [meta.sessionId, meta]),
    );
    const candidateList = this.sessionManager
      .list()
      .filter((sessionInfo) => sessionInfo.id !== this.#activeThreadSessionId)
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

  async #writeThreadHandoffNote(
    sourceSessionId: string,
    targetSessionId: string,
  ): Promise<void> {
    const sourceHistory = await this.sessionManager
      .getSession(sourceSessionId)
      .getRecentHistory(THREAD_HANDOFF_BYTE_BUDGET, 2);
    const handoffNote = buildThreadHandoffNote({
      previousThreadTitle: this.sessionManager.get(sourceSessionId)?.name ?? '',
      messageList: sourceHistory.messages,
    });
    if (handoffNote === undefined) {
      return;
    }
    const targetSession = this.sessionManager.getSession(targetSessionId);
    await targetSession.replaceContextBlock('handoff', handoffNote);
    await targetSession.refreshSystemPrompt();
  }

  async finalizeThread(rawPayload: FinalizeThreadPayload): Promise<void> {
    const payload = finalizeThreadPayloadSchema.parse(rawPayload);
    const sqlExecutor = this.#sqlExecutor();
    // A resumed thread is active again by the time a delayed finalizer fires;
    // digesting it now would freeze the old transcript and pin it, because
    // later closes skip non-pending meta. Rotation away reschedules this.
    const activeThreadSessionId =
      this.#activeThreadSessionId ??
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
        const recentHistory = await this.sessionManager
          .getSession(payload.sessionId)
          .getRecentHistory(THREAD_FINALIZATION_TRANSCRIPT_BYTE_BUDGET, 10);
        return recentHistory.messages;
      },
      generateThreadDigest: async (transcriptText) => {
        // Mock mode has no LLM to call; a dev session must not burn tokens.
        if (this.env.MOCK_VOICE === '1' || transcriptText.length === 0) {
          return undefined;
        }
        const chatResult = await chatWithOpenRouter({
          openRouterApiKey: this.env.OPENROUTER_API_KEY,
          modelId: this.env.OPENROUTER_MODEL,
          messageList: buildThreadDigestMessageList(transcriptText),
        });
        return parseThreadDigestResult(chatResult.text);
      },
      renameThread: async (title) => {
        this.sessionManager.rename(payload.sessionId, title);
      },
      persistOutcome: async (outcome) => {
        markThreadFinalized(sqlExecutor, {
          sessionId: payload.sessionId,
          kind: outcome.kind,
          summary: outcome.summary,
        });
        // The summary rides the same embedding pipeline as owner facts; the
        // thread- prefix is what resume_conversation later maps back to a
        // session id.
        if (outcome.kind === 'conversation' && outcome.summary !== null) {
          await enqueueMemoryIndexJob(this.env, {
            memoryId: `${THREAD_VECTOR_MEMORY_ID_PREFIX}${payload.sessionId}`,
            content:
              outcome.title !== null
                ? `${outcome.title}: ${outcome.summary}`
                : outcome.summary,
            deviceId: this.name ?? 'default',
          });
        }
      },
    });
  }

  #currentFocusState(): DeskFocusState {
    if (this.state.focusEndsAt === null) {
      return createInactiveDeskFocusState();
    }
    return tickDeskFocus({ active: true, endsAt: this.state.focusEndsAt }, Date.now());
  }

  async #ensureTelemetrySnapshotLoaded(): Promise<void> {
    if (this.#lastTelemetrySnapshot !== undefined) {
      return;
    }
    const storedSnapshot = await getSessionPreference(
      this.#sqlExecutor(),
      TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
    );
    if (storedSnapshot !== undefined && storedSnapshot !== null) {
      this.#lastTelemetrySnapshot = parseStoredTelemetrySnapshot(storedSnapshot);
    }
  }

  #sqlExecutor(): MemorySqlExecutor {
    return createDurableObjectSqlExecutor(this.ctx.storage.sql);
  }

  async #ensurePreferencesLoaded(): Promise<void> {
    if (this.#didLoadPreferences) {
      return;
    }
    const storedSpeechModeId = await getSessionPreference(
      this.#sqlExecutor(),
      'speechMode',
    );
    const legacyPersonaId =
      storedSpeechModeId === null
        ? await getSessionPreference(this.#sqlExecutor(), 'personaId')
        : null;
    const rawSpeechModeId = storedSpeechModeId ?? legacyPersonaId;
    if (rawSpeechModeId !== null) {
      const speechMode = resolveDeskSpeechMode(rawSpeechModeId);
      await setSessionPreference(this.#sqlExecutor(), 'speechMode', speechMode.id);
      this.setState({
        ...this.state,
        speechMode: speechMode.id,
      });
    }
    this.#didLoadPreferences = true;
  }

  #applyUiEvent(eventName: Parameters<DeskUiMachine['transition']>[0]): void {
    this.#uiMachine.transition(eventName);
    this.setState({
      ...this.state,
      uiState: this.#uiMachine.state,
    });
  }

  #pushUiState(connection: Connection): void {
    const uiStateMessage: UiStatePushMessage = {
      type: 'ui_state',
      state: this.state.uiState,
      speechMode: this.state.speechMode,
      caption: this.state.caption ?? undefined,
      emotion: resolveDeskFaceEmotion(this.state.uiState),
      accentColor: resolveDeskSpeechMode(this.state.speechMode).accentColor,
    };
    if (this.state.focusEndsAt !== null) {
      uiStateMessage.focusRemainingSec = Math.max(
        0,
        Math.ceil((this.state.focusEndsAt - Date.now()) / 1000),
      );
      uiStateMessage.focusEndsAt = Math.floor(this.state.focusEndsAt / 1000);
      if (this.state.focusStartedAt !== null) {
        uiStateMessage.focusStartedAt = Math.floor(this.state.focusStartedAt / 1000);
      }
    }
    connection.send(encodeServerToDeviceMessage(uiStateMessage));
  }

  async #pushDashboard(connection: Connection): Promise<void> {
    const location = await this.#resolveWeatherLocation();
    const weatherSnapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: location.latitude,
      longitude: location.longitude,
      locationLabel: location.locationLabel,
      lastKnownSnapshot: this.#lastKnownWeatherSnapshot,
    });
    if (weatherSnapshot.conditionLabel !== UNAVAILABLE_WEATHER_CONDITION_LABEL) {
      this.#lastKnownWeatherSnapshot = weatherSnapshot;
    }
    const dashboardPayload = await buildDeskDashboardPayload({
      timezone: location.timezone,
      weather: weatherSnapshot,
    });
    connection.send(encodeServerToDeviceMessage(dashboardPayload));
  }

  async #flushPendingDeviceMessages(connection: Connection): Promise<void> {
    const pendingMessageList = await sweepExpiredBroadcasts({
      pendingMessageList: await listPendingDeviceMessages(this.#sqlExecutor()),
      sqlExecutor: this.#sqlExecutor(),
      mediaBucket: this.env.MEDIA,
      nowMilliseconds: Date.now(),
    });
    for (const pendingMessage of pendingMessageList) {
      if (
        pendingMessage.type === 'broadcast_text' ||
        pendingMessage.type === 'broadcast_audio'
      ) {
        // Queued broadcasts replay with sound: the owner left a message for
        // whoever is near the desk, not a silent card.
        await replayPendingBroadcast({
          pendingMessage,
          connectionList: [connection],
          mediaBucket: this.env.MEDIA,
          environment: this.env,
          ttsVoiceId: APOLLO_TTS_VOICE,
          isMockVoice: this.env.MOCK_VOICE === '1',
          playChimeEffect: () => this.#broadcastPlayEffect('chime'),
        });
      } else {
        connection.send(
          encodeServerToDeviceMessage(
            parsePendingDeviceMessageAsNotification(pendingMessage),
          ),
        );
      }
      await deletePendingDeviceMessage(this.#sqlExecutor(), pendingMessage.id);
    }
  }

  async #handleGesture(
    connection: Connection,
    gesture: 'tap' | 'double_tap' | 'swipe_left' | 'swipe_right',
  ): Promise<void> {
    if (gesture === 'tap') {
      const previousUiState: DeskUiState = this.state.uiState;
      if (previousUiState === 'dashboard') {
        this.#applyUiEvent('CLOSE_DASHBOARD');
      } else if (previousUiState === 'idle') {
        this.#applyUiEvent('OPEN_DASHBOARD');
      }
      this.#pushUiState(connection);
      const nextUiState: DeskUiState = this.state.uiState;
      if (previousUiState === 'idle' && nextUiState === 'dashboard') {
        await this.#pushDashboard(connection);
      }
      return;
    }
    if (gesture === 'double_tap') {
      // Muting used to live here. With press-and-hold the microphone is only
      // ever open while a finger is down, so there is nothing to mute, and an
      // accidental double tap silently swallowing every turn was a trap.
      return;
    }
    const direction = gesture === 'swipe_right' ? 1 : -1;
    const nextSpeechMode = cycleDeskSpeechMode(this.state.speechMode, direction);
    await setSessionPreference(this.#sqlExecutor(), 'speechMode', nextSpeechMode.id);
    this.setState({
      ...this.state,
      speechMode: nextSpeechMode.id,
      // No caption on purpose: the mode change is announced by the accent ring
      // color (and the switch sound), not by a text label.
      caption: null,
    });
    this.#pushUiState(connection);
  }

  async #handleTelemetry(
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
    // lifecycle diffs versions across it — and after a deploy or hibernation
    // the in-memory copy is gone, which is exactly the post-OTA-reboot case,
    // so the stored copy is the fallback.
    let previousSnapshot = this.#lastTelemetrySnapshot;
    if (previousSnapshot === undefined) {
      const storedSnapshot = await getSessionPreference(
        this.#sqlExecutor(),
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
    this.#lastTelemetrySnapshot = snapshot;
    // A deploy or hibernation wipes the in-memory snapshot, and the next turn
    // may run before the device's next telemetry tick — the prompt would then
    // silently miss battery/firmware. The stored copy bridges that gap.
    await setSessionPreference(
      this.#sqlExecutor(),
      TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
      JSON.stringify(snapshot),
    );

    await this.#handleLowBatteryAnnouncement(snapshot);
    try {
      await runFirmwareLifecycle(
        {
          previousFirmwareVersion: previousSnapshot?.firmwareVersion,
          snapshot,
          didChargingEdgeOccur,
        },
        {
          sqlExecutor: this.#sqlExecutor(),
          mediaBucket: this.env.MEDIA,
          deviceSharedSecret: this.env.DEVICE_SHARED_SECRET,
          isPushDisabled: this.env.FIRMWARE_PUSH_DISABLED === '1',
          uiState: this.state.uiState,
          isFocusActive: this.#currentFocusState().active,
          hasPendingConfirmation: this.state.pendingConfirmId !== null,
          isAnnouncementInFlight:
            this.#isAnnouncingLowBattery || this.#isDeliveringInitiative,
          nowMilliseconds: Date.now(),
          deliverInitiativeUtterance: (utterance) =>
            this.#deliverInitiativeUtterance(utterance),
          hasScheduledInitiativeRetry: async (source) =>
            hasScheduledInitiativeRetryForSource(await this.listSchedules(), source),
          callDeviceTool: (deviceToolName, argumentRecord) =>
            this.#callDeviceTool(deviceToolName, argumentRecord),
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

  async #handleLowBatteryAnnouncement(snapshot: DeskTelemetrySnapshot): Promise<void> {
    const storedAnnounceAt = await getSessionPreference(
      this.#sqlExecutor(),
      LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
    );
    const parsedAnnounceAt = Number(storedAnnounceAt);
    const lastAnnounceAtMilliseconds =
      Number.isFinite(parsedAnnounceAt) && parsedAnnounceAt > 0 ? parsedAnnounceAt : null;

    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot,
      lastAnnounceAtMilliseconds,
      nowMilliseconds: Date.now(),
    });
    if (evaluation.shouldRearm) {
      await setSessionPreference(
        this.#sqlExecutor(),
        LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
        '0',
      );
    }
    if (!evaluation.shouldAnnounce || evaluation.message === undefined) {
      return;
    }
    // The cooldown is only persisted after delivery succeeds, so a failure
    // retries on the next telemetry instead of going silent for half an hour.
    // Delivery spans seconds of paced streaming, though, and a charging-edge
    // telemetry arriving mid-announcement would read the still-expired
    // cooldown — the in-flight flag closes that window.
    if (this.#isAnnouncingLowBattery) {
      return;
    }
    this.#isAnnouncingLowBattery = true;
    try {
      const deliveryOutcome = await this.#deliverInitiativeUtterance({
        source: 'low_battery',
        priority: 'critical',
        message: evaluation.message,
        earconName: 'low_battery',
      });
      if (deliveryOutcome === 'delivered') {
        await setSessionPreference(
          this.#sqlExecutor(),
          LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
          String(Date.now()),
        );
      }
    } finally {
      this.#isAnnouncingLowBattery = false;
    }
  }

  async #buildTurnToolDefinitionMap(
    effects: DeskToolEffects,
  ): Promise<ReadonlyMap<string, ToolDefinition>> {
    const [discoveredToolList, settingList] = await Promise.all([
      discoverInstalledMcpToolList(this.mcp),
      listMcpToolSettings(this.#sqlExecutor()),
    ]);
    return buildTurnToolDefinitionMap({
      discoveredToolList,
      settingList,
      serverRecordMap: this.getMcpServers().servers,
      callInstalledMcpTool: effects.callInstalledMcpTool,
    });
  }

  async #callDeviceTool(
    deviceToolName: string,
    argumentRecord: DeviceToolArgumentRecord,
  ): Promise<ToolExecutionResult> {
    const connectionList = [...this.getConnections(DEVICE_CONNECTION_TAG)];
    if (connectionList.length === 0) {
      return { ok: false, summary: 'El dispositivo no está conectado.' };
    }
    const { requestId, responsePromise } =
      this.#deviceMcpRequestRegistry.createPendingRequest(
        DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
      );
    const encodedMessage = encodeServerToDeviceMessage({
      type: 'mcp',
      payload: buildDeviceToolCallPayload(requestId, deviceToolName, argumentRecord),
    });
    for (const connection of connectionList) {
      connection.send(encodedMessage);
    }
    return summarizeDeviceToolResult(await responsePromise);
  }

  #broadcastPlayEffect(effectName: DeskSoundEffectName): void {
    const encodedMessage = encodeServerToDeviceMessage({
      type: 'play_effect',
      name: effectName,
    });
    for (const connection of this.getConnections(DEVICE_CONNECTION_TAG)) {
      connection.send(encodedMessage);
    }
  }

  #broadcastConfirmClose(confirmId: string, reason: ConfirmCloseReasonName): void {
    const encodedMessage = encodeServerToDeviceMessage({
      type: 'confirm_close',
      id: confirmId,
      reason,
    });
    for (const connection of this.getConnections(DEVICE_CONNECTION_TAG)) {
      connection.send(encodedMessage);
    }
  }

  #broadcastTimerArc(
    arc:
      | { readonly endsAtEpochSeconds: number; readonly durationSeconds: number }
      | undefined,
  ): void {
    const encodedMessage = encodeServerToDeviceMessage(
      arc === undefined
        ? { type: 'timer' }
        : {
            type: 'timer',
            endsAt: arc.endsAtEpochSeconds,
            durationSeconds: arc.durationSeconds,
          },
    );
    for (const connection of this.getConnections(DEVICE_CONNECTION_TAG)) {
      connection.send(encodedMessage);
    }
  }

  async #broadcastSoonestRemainingTimerArc(): Promise<void> {
    const remainingReminderList = mapAgentScheduleListToReminderList(
      await this.listSchedules(),
    );
    const remainingTimerList = remainingReminderList
      .filter(
        (reminder) =>
          reminder.message.startsWith('Timer') && reminder.delayInSeconds !== undefined,
      )
      .toSorted((left, right) => left.firesAtIso.localeCompare(right.firesAtIso));
    const soonestTimer = remainingTimerList[0];
    if (soonestTimer === undefined || soonestTimer.delayInSeconds === undefined) {
      this.#broadcastTimerArc(undefined);
      return;
    }
    this.#broadcastTimerArc({
      endsAtEpochSeconds: Math.floor(Date.parse(soonestTimer.firesAtIso) / 1000),
      durationSeconds: soonestTimer.delayInSeconds,
    });
  }

  async #runTurnFromText(connection: Connection, text: string): Promise<void> {
    this.#applyUiEvent('START_LISTEN');
    await this.#executeTurn(connection, { text });
  }

  async #runTurnFromAudio(connection: Connection): Promise<void> {
    const audioBuffer = concatenateArrayBufferList(this.#audioChunkList);
    this.#audioChunkList = [];

    // A press that ends before the audio channel finishes opening leaves nothing
    // recorded. Sending that to the transcriber earns a 400 and shows the user a
    // failure for something that was never their mistake.
    if (audioBuffer.byteLength < MINIMUM_TURN_AUDIO_BYTE_LENGTH) {
      this.#applyUiEvent('CANCEL');
      this.setState({
        ...this.state,
        uiState: this.#uiMachine.state,
        caption: 'No llegué a escucharte, mantené apretado un momento más.',
      });
      this.#pushUiState(connection);
      return;
    }

    await this.#executeTurn(connection, { audioBuffer });
  }

  async #resolveConfirm(connection: Connection, isApproved: boolean): Promise<void> {
    const pendingConfirmation =
      this.#pendingConfirmation ??
      (await readPendingToolConfirmation(this.#sqlExecutor()));
    if (pendingConfirmation === undefined) {
      if (
        isPendingConfirmationOrphaned({
          restoredConfirmation: pendingConfirmation,
          pendingConfirmIdInState: this.state.pendingConfirmId,
        })
      ) {
        await this.#closePendingConfirmation(
          'Se me perdió esa confirmación, pedímelo de nuevo.',
          'orphaned',
        );
      }
      return;
    }
    this.#pendingConfirmation = undefined;
    await deletePendingToolConfirmations(this.#sqlExecutor());
    this.#broadcastConfirmClose(pendingConfirmation.id, 'resolved');
    await this.#executeTurn(connection, {
      text: isApproved ? 'confirmado' : 'cancelado',
      confirmOk: isApproved,
      pendingConfirmation,
    });
  }

  async #executeTurn(
    connection: Connection,
    turnPart: {
      readonly text?: string;
      readonly audioBuffer?: ArrayBuffer;
      readonly confirmOk?: boolean;
      readonly pendingConfirmation?: PendingToolConfirmation;
    },
  ): Promise<void> {
    const deviceId = this.name ?? 'default';
    this.#isSpeechAborted = false;
    await this.#ensureTelemetrySnapshotLoaded();
    await this.#rotateThreadForTurn();
    const deskToolEffects = createDeskToolEffects({
      sqlExecutor: this.#sqlExecutor(),
      environment: this.env,
      deviceId,
      session: this.session,
      applyFocusMinutes: async (minutes) => {
        const startedAt = Date.now();
        const nextFocus = startDeskFocus(startedAt, minutes * 60);
        this.setState({
          ...this.state,
          focusEndsAt: nextFocus.endsAt,
          focusStartedAt: startedAt,
        });
      },
      clearFocus: async () => {
        this.setState({
          ...this.state,
          focusEndsAt: clearDeskFocus().endsAt,
          focusStartedAt: null,
        });
      },
      scheduleReminder: async ({ delaySeconds, message }) => {
        await this.schedule(delaySeconds, 'deliverReminder', { message });
      },
      broadcastTimerProgress: async ({ durationSeconds }) => {
        this.#broadcastTimerArc({
          endsAtEpochSeconds: Math.floor(Date.now() / 1000) + durationSeconds,
          durationSeconds,
        });
      },
      listReminders: async () => {
        return mapAgentScheduleListToReminderList(await this.listSchedules());
      },
      cancelReminders: async ({ message, cancelAll }) => {
        const reminderList = mapAgentScheduleListToReminderList(
          await this.listSchedules(),
        );
        const selectedReminderList = selectReminderRowsForCancel(reminderList, {
          message,
          cancelAll,
        });
        const cancelledMessageList: string[] = [];
        for (const reminder of selectedReminderList) {
          const didCancel = await this.cancelSchedule(reminder.id);
          if (didCancel) {
            cancelledMessageList.push(reminder.message);
          }
        }
        // Timers are reminders whose message starts with "Timer" (see
        // @/tools/timer); cancelling one has to take its arc off the screen —
        // unless another timer is still running, whose arc takes over.
        if (cancelledMessageList.some((cancelled) => cancelled.startsWith('Timer'))) {
          await this.#broadcastSoonestRemainingTimerArc();
        }
        return {
          cancelledCount: cancelledMessageList.length,
          cancelledMessageList,
        };
      },
      resolveWeatherLocation: async () => this.#resolveWeatherLocation(),
      persistWeatherLocation: async (location) => {
        await setSessionPreference(
          this.#sqlExecutor(),
          WEATHER_LOCATION_PREFERENCE_KEY,
          serializeWeatherLocation(location),
        );
      },
      searchThreadHistory: async ({ query, limit }) =>
        this.sessionManager.search(query, { limit }).map((match) => ({
          id: match.id,
          role: match.role,
          content: match.content,
        })),
      resumeConversationThread: async ({ query }) =>
        this.#resumeConversationThread(query),
      callDeviceTool: async ({ deviceToolName, argumentRecord }) =>
        this.#callDeviceTool(deviceToolName, argumentRecord),
      callInstalledMcpTool: async (call) => callInstalledMcpTool(this.mcp, call),
    });

    const toolDefinitionMap = await this.#buildTurnToolDefinitionMap(deskToolEffects);

    try {
      await executeApolloTurn(
        connection,
        {
          environment: this.env,
          sqlExecutor: this.#sqlExecutor(),
          uiMachine: this.#uiMachine,
          currentState: this.state,
          getCurrentState: () => this.state,
          setAgentState: (nextState) => {
            this.setState(nextState);
          },
          scheduleConfirmExpiry: async (confirmationId) => {
            await this.schedule(30, 'expireConfirm', { confirmationId });
          },
          persistPendingConfirmation: async (confirmation) => {
            this.#pendingConfirmation = confirmation;
            await savePendingToolConfirmation(this.#sqlExecutor(), confirmation);
          },
          session: this.session,
          deviceId,
          effects: deskToolEffects,
          toolDefinitionMap,
          isSpeechAborted: () => this.#isSpeechAborted,
          allocateTtsSequence: () => {
            this.#ttsSequence += 1;
            return this.#ttsSequence;
          },
          getPlaybackAckForSequence: (sequence) =>
            this.#lastPlaybackAck !== null && this.#lastPlaybackAck.sequence === sequence
              ? {
                  playedMilliseconds: this.#lastPlaybackAck.playedMilliseconds,
                  receivedAtMilliseconds: this.#lastPlaybackAck.receivedAtMilliseconds,
                }
              : null,
          telemetrySnapshot: this.#lastTelemetrySnapshot,
        },
        turnPart,
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apollo_turn_failed',
          deviceId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      this.#pendingConfirmation = undefined;
      // The confirmation persists before the turn finishes streaming, so a
      // failure after that point would otherwise leave a resolvable row for a
      // request the user was just told failed.
      await deletePendingToolConfirmations(this.#sqlExecutor());
      this.#applyUiEvent('CANCEL');
      this.setState({
        ...this.state,
        uiState: this.#uiMachine.state,
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
          message: error instanceof Error ? error.message : 'Error desconocido',
        }),
      );
    }
    this.#pushUiState(connection);
  }
}

export async function authorizeApolloConnection(
  request: Request,
  environment: Env,
): Promise<Response | undefined> {
  const connectionRole = await resolveApolloConnectionRole(
    new URL(request.url),
    environment,
  );
  if (connectionRole === null) {
    return new Response('Unauthorized', { status: 401 });
  }
  return undefined;
}
