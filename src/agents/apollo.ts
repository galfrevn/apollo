import {
  Agent,
  callable,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from 'agents';
import type { Session } from 'agents/experimental/memory/session';

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
  DEVICE_CONNECTION_TAG,
  hasDeviceConnectionTag,
  resolveApolloConnectionRole,
} from '@/auth/role';
import { isDeviceSharedSecretValid } from '@/auth/token';
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
import { resolveDiscoveredMcpToolSafety } from '@/mcp/adapter';
import {
  buildDeviceToolCallPayload,
  createDeviceMcpRequestRegistry,
  DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
  summarizeDeviceToolResult,
} from '@/mcp/bridge';
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
  setMcpToolEnabledInputSchema,
  type McpServerSummary,
} from '@/mcp/servers';
import {
  deleteMcpToolSettingsForServer,
  listMcpToolSettings,
  saveMcpToolSetting,
} from '@/mcp/settings';
import { OWNER_MEMORY_CONSOLIDATION_CRON } from '@/memory/consolidate';
import { runOwnerMemoryConsolidation } from '@/memory/nightly';
import { deletePendingDeviceMessage, listPendingDeviceMessages } from '@/memory/pending';
import { createApolloSession } from '@/memory/session';
import {
  getSessionPreference,
  setSessionPreference,
  type MemorySqlExecutor,
} from '@/memory/store';
import { PUBLIC_ORIGIN_PREFERENCE_KEY, runFirmwareLifecycle } from '@/ota/lifecycle';
import { cycleDeskSpeechMode, resolveDeskSpeechMode } from '@/persona/catalog';
import { resolveDeskFaceEmotion } from '@/persona/face';
import { APOLLO_TTS_VOICE } from '@/persona/soul';
import {
  encodeServerToDeviceMessage,
  parseDeviceToServerMessage,
  type ConfirmCloseReasonName,
  type DeskSoundEffectName,
  type DeviceToServerMessage,
} from '@/protocol/schema';
import {
  mapAgentScheduleListToReminderList,
  selectReminderRowsForCancel,
  type AgentScheduleLike,
} from '@/reminders/logic';
import { createDeskUiMachine, type DeskUiMachine } from '@/session/machine';
import {
  evaluateLowBatteryAnnouncement,
  parseStoredTelemetrySnapshot,
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';
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

function mapUnknownScheduleListToAgentScheduleLikeList(
  scheduleList: readonly {
    readonly id: string;
    readonly callback: string;
    readonly payload: unknown;
    readonly time: number;
    readonly type?: string;
    readonly delayInSeconds?: number;
  }[],
): readonly AgentScheduleLike[] {
  return scheduleList.map((schedule) => ({
    id: schedule.id,
    callback: schedule.callback,
    payload: schedule.payload,
    time: schedule.time,
    ...(schedule.type !== undefined ? { type: schedule.type } : {}),
    ...(typeof schedule.delayInSeconds === 'number'
      ? { delayInSeconds: schedule.delayInSeconds }
      : {}),
  }));
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
  #session: Session | undefined;
  #lastKnownWeatherSnapshot: DeskWeatherSnapshot | undefined;
  #lastTelemetrySnapshot: DeskTelemetrySnapshot | undefined;
  #isAnnouncingLowBattery = false;
  #isDeliveringInitiative = false;
  #isConsolidatingMemory = false;
  #deviceMcpRequestRegistry = createDeviceMcpRequestRegistry();
  #ttsSequence = 0;
  #lastPlaybackAck: {
    readonly sequence: number;
    readonly playedMilliseconds: number;
    readonly receivedAtMilliseconds: number;
  } | null = null;

  get session(): Session {
    if (this.#session === undefined) {
      this.#session = createApolloSession(this, this.env.MEDIA);
    }
    return this.#session;
  }

  async onStart(): Promise<void> {
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
    this.#session = createApolloSession(this, this.env.MEDIA);
    await this.#ensurePreferencesLoaded();
    await this.scheduleEvery(
      DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
      'refreshDashboardWeather',
    );
    await this.schedule(OWNER_MEMORY_CONSOLIDATION_CRON, 'consolidateOwnerMemory');
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
    if (typeof message !== 'string') {
      // A binary frame is mic audio by definition; one from anywhere else would
      // be transcribed into the owner's next sentence.
      if (!hasDeviceConnectionTag(connection.tags)) {
        return;
      }
      this.#audioChunkList.push(message as ArrayBuffer);
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
  async installMcpServer(rawInput: unknown): Promise<{
    readonly serverId: string;
    readonly state: string;
    readonly authUrl: string | null;
  }> {
    const input = installMcpServerInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    const installResult = await this.addMcpServer(input.name, input.url);
    return {
      serverId: installResult.id,
      state: installResult.state,
      authUrl: 'authUrl' in installResult ? installResult.authUrl : null,
    };
  }

  @callable()
  async uninstallMcpServer(rawInput: unknown): Promise<readonly McpServerSummary[]> {
    const input = removeMcpServerInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    await this.removeMcpServer(input.serverId);
    await deleteMcpToolSettingsForServer(this.#sqlExecutor(), input.serverId);
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async listMcpServers(rawInput: unknown): Promise<readonly McpServerSummary[]> {
    const input = mcpSecretInputSchema.parse(rawInput);
    await this.#assertDashboardSecret(input.secret);
    return this.#listMcpServerSummaryList();
  }

  @callable()
  async enableMcpTool(rawInput: unknown): Promise<readonly McpServerSummary[]> {
    return this.#setMcpToolEnabled(rawInput, true);
  }

  @callable()
  async disableMcpTool(rawInput: unknown): Promise<readonly McpServerSummary[]> {
    return this.#setMcpToolEnabled(rawInput, false);
  }

  async #setMcpToolEnabled(
    rawInput: unknown,
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
  async setSpeechMode(speechModeId: string): Promise<ApolloState> {
    const speechMode = resolveDeskSpeechMode(speechModeId);
    await setSessionPreference(this.#sqlExecutor(), 'speechMode', speechMode.id);
    this.setState({
      ...this.state,
      speechMode: speechMode.id,
      caption: null,
    });
    return this.state;
  }

  async expireConfirm(payload: unknown): Promise<void> {
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

  async deliverReminder(payload: unknown): Promise<void> {
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
  async notifyBackgroundResult(input: unknown): Promise<void> {
    const parsedInput = notifyBackgroundResultInputSchema.parse(input);
    await deliverDeskDeviceNotification({
      notification: {
        type: 'background_result',
        prompt: parsedInput.prompt,
        summary: parsedInput.summary,
        ...(parsedInput.documentKey !== undefined
          ? { documentKey: parsedInput.documentKey }
          : {}),
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
        ...(decision.action !== 'deliver' ? { reason: decision.reason } : {}),
      }),
    );
    if (decision.action === 'defer') {
      const retryDelaySeconds = Math.max(
        60,
        Math.ceil((decision.retryAtMilliseconds - nowMilliseconds) / 1000),
      );
      await this.schedule(retryDelaySeconds, 'retryInitiativeUtterance', {
        source: input.source,
        priority: input.priority,
        message: input.message,
        ...(input.earconName !== undefined ? { earconName: input.earconName } : {}),
        ...(input.utteranceKey !== undefined ? { utteranceKey: input.utteranceKey } : {}),
        deferCount,
      });
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
        ...(input.priority === 'critical' ? { announceKind: 'critical' as const } : {}),
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

  async retryInitiativeUtterance(payload: unknown): Promise<void> {
    const parsedPayload = retryInitiativeUtterancePayloadSchema.parse(payload);
    const nextDeferCount = parsedPayload.deferCount + 1;
    const retryPayload = {
      source: parsedPayload.source,
      priority: parsedPayload.priority,
      message: parsedPayload.message,
      ...(parsedPayload.earconName !== undefined
        ? { earconName: parsedPayload.earconName }
        : {}),
      ...(parsedPayload.utteranceKey !== undefined
        ? { utteranceKey: parsedPayload.utteranceKey }
        : {}),
    };
    const deliveryOutcome = await this.#deliverInitiativeUtterance({
      ...retryPayload,
      deferCount: nextDeferCount,
    });
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
        { ...retryPayload, deferCount: nextDeferCount },
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
      });
    } finally {
      this.#isConsolidatingMemory = false;
    }
  }

  #currentFocusState(): DeskFocusState {
    if (this.state.focusEndsAt === null) {
      return createInactiveDeskFocusState();
    }
    return tickDeskFocus({ active: true, endsAt: this.state.focusEndsAt }, Date.now());
  }

  #sqlExecutor(): MemorySqlExecutor {
    return {
      execute: <Row extends Record<string, unknown>>(
        query: string,
        ...bindValues: unknown[]
      ): readonly Row[] => {
        const result = this.ctx.storage.sql.exec(query, ...bindValues);
        return result.toArray() as unknown as readonly Row[];
      },
    };
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
    const focusRemainingSec =
      this.state.focusEndsAt === null
        ? undefined
        : Math.max(0, Math.ceil((this.state.focusEndsAt - Date.now()) / 1000));
    connection.send(
      encodeServerToDeviceMessage({
        type: 'ui_state',
        state: this.state.uiState,
        speechMode: this.state.speechMode,
        caption: this.state.caption ?? undefined,
        focusRemainingSec,
        ...(this.state.focusEndsAt !== null
          ? {
              focusEndsAt: Math.floor(this.state.focusEndsAt / 1000),
              ...(this.state.focusStartedAt !== null &&
              this.state.focusStartedAt !== undefined
                ? { focusStartedAt: Math.floor(this.state.focusStartedAt / 1000) }
                : {}),
            }
          : {}),
        emotion: resolveDeskFaceEmotion(this.state.uiState),
        accentColor: resolveDeskSpeechMode(this.state.speechMode).accentColor,
      }),
    );
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
    const pendingMessageList = await listPendingDeviceMessages(this.#sqlExecutor());
    for (const pendingMessage of pendingMessageList) {
      connection.send(
        encodeServerToDeviceMessage(
          parsePendingDeviceMessageAsNotification(pendingMessage),
        ),
      );
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
      ...(deviceMessage.battery !== undefined ? { battery: deviceMessage.battery } : {}),
      ...(deviceMessage.charging !== undefined
        ? { charging: deviceMessage.charging }
        : {}),
      ...(deviceMessage.volume !== undefined ? { volume: deviceMessage.volume } : {}),
      ...(deviceMessage.wifiRssi !== undefined
        ? { wifiRssi: deviceMessage.wifiRssi }
        : {}),
      ...(deviceMessage.firmwareVersion !== undefined
        ? { firmwareVersion: deviceMessage.firmwareVersion }
        : {}),
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
    argumentRecord: Record<string, unknown>,
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
      mapUnknownScheduleListToAgentScheduleLikeList(await this.listSchedules()),
    );
    const remainingTimerList = remainingReminderList
      .filter(
        (reminder) =>
          reminder.message.startsWith('Timer') &&
          typeof reminder.delayInSeconds === 'number',
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
    if (this.#lastTelemetrySnapshot === undefined) {
      const storedSnapshot = await getSessionPreference(
        this.#sqlExecutor(),
        TELEMETRY_SNAPSHOT_PREFERENCE_KEY,
      );
      if (storedSnapshot !== undefined && storedSnapshot !== null) {
        this.#lastTelemetrySnapshot = parseStoredTelemetrySnapshot(storedSnapshot);
      }
    }
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
        const scheduleList = await this.listSchedules();
        return mapAgentScheduleListToReminderList(
          mapUnknownScheduleListToAgentScheduleLikeList(scheduleList),
        );
      },
      cancelReminders: async ({ message, cancelAll }) => {
        const reminderList = mapAgentScheduleListToReminderList(
          mapUnknownScheduleListToAgentScheduleLikeList(await this.listSchedules()),
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
          ...(this.#lastTelemetrySnapshot !== undefined
            ? { telemetrySnapshot: this.#lastTelemetrySnapshot }
            : {}),
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
