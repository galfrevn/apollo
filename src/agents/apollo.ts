import { Agent, callable, type Connection, type WSMessage } from 'agents';
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
} from '@/agents/rpc';
import { concatenateArrayBufferList, executeApolloTurn } from '@/agents/runtime';
import { isDeviceSharedSecretValid, readDeviceTokenFromRequestUrl } from '@/auth/token';
import {
  clearDeskFocus,
  createInactiveDeskFocusState,
  startDeskFocus,
  tickDeskFocus,
  type DeskFocusState,
} from '@/focus/logic';
import {
  buildDeviceToolCallPayload,
  createDeviceMcpRequestRegistry,
  DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS,
  summarizeDeviceToolResult,
} from '@/mcp/bridge';
import { deletePendingDeviceMessage, listPendingDeviceMessages } from '@/memory/pending';
import { createApolloSession } from '@/memory/session';
import {
  getSessionPreference,
  setSessionPreference,
  type MemorySqlExecutor,
} from '@/memory/store';
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
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';
import {
  deletePendingToolConfirmations,
  isPendingConfirmationOrphaned,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';
import type { PendingToolConfirmation, ToolExecutionResult } from '@/tools/types';
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
  readonly caption: string | null;
  readonly pendingConfirmId: string | null;
  readonly pendingConfirmSummary: string | null;
};

export class Apollo extends Agent<Env, ApolloState> {
  initialState: ApolloState = {
    uiState: 'idle',
    speechMode: 'default',
    focusEndsAt: null,
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
  #deviceMcpRequestRegistry = createDeviceMcpRequestRegistry();

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
    this.#session = createApolloSession(this, this.env.MEDIA);
    await this.#ensurePreferencesLoaded();
    await this.scheduleEvery(
      DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
      'refreshDashboardWeather',
    );
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

    const connectionList = [...this.getConnections()];
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

  async onConnect(connection: Connection): Promise<void> {
    await this.#ensurePreferencesLoaded();
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
    }
  }

  @callable()
  async confirmAction(isApproved: boolean): Promise<ApolloState> {
    const connection = [...this.getConnections()][0];
    if (connection === undefined) {
      return this.state;
    }
    await this.#resolveConfirm(connection, isApproved);
    return this.state;
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
    for (const connection of this.getConnections()) {
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
      connectionList: [...this.getConnections()],
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
      connectionList: [...this.getConnections()],
      sqlExecutor: this.#sqlExecutor(),
      focusState: this.#currentFocusState(),
      environment: this.env,
      deviceId: this.name ?? 'default',
      ttsVoiceId: APOLLO_TTS_VOICE,
      isMockVoice: this.env.MOCK_VOICE === '1',
    });
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
    this.#lastTelemetrySnapshot = snapshot;

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
      this.#broadcastPlayEffect('low_battery');
      await deliverDeskDeviceNotification({
        notification: { type: 'reminder', message: evaluation.message },
        connectionList: [...this.getConnections()],
        sqlExecutor: this.#sqlExecutor(),
        focusState: this.#currentFocusState(),
        environment: this.env,
        deviceId: this.name ?? 'default',
        ttsVoiceId: APOLLO_TTS_VOICE,
        isMockVoice: this.env.MOCK_VOICE === '1',
        announceKind: 'critical',
      });
      await setSessionPreference(
        this.#sqlExecutor(),
        LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
        String(Date.now()),
      );
    } finally {
      this.#isAnnouncingLowBattery = false;
    }
  }

  async #callDeviceTool(
    deviceToolName: string,
    argumentRecord: Record<string, unknown>,
  ): Promise<ToolExecutionResult> {
    const connectionList = [...this.getConnections()];
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
    for (const connection of this.getConnections()) {
      connection.send(encodedMessage);
    }
  }

  #broadcastConfirmClose(confirmId: string, reason: ConfirmCloseReasonName): void {
    const encodedMessage = encodeServerToDeviceMessage({
      type: 'confirm_close',
      id: confirmId,
      reason,
    });
    for (const connection of this.getConnections()) {
      connection.send(encodedMessage);
    }
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
    // A new turn clears any interruption left over from the previous one.
    this.#isSpeechAborted = false;
    const deskToolEffects = createDeskToolEffects({
      sqlExecutor: this.#sqlExecutor(),
      environment: this.env,
      deviceId,
      session: this.session,
      applyFocusMinutes: async (minutes) => {
        const nextFocus = startDeskFocus(Date.now(), minutes * 60);
        this.setState({ ...this.state, focusEndsAt: nextFocus.endsAt });
      },
      clearFocus: async () => {
        this.setState({ ...this.state, focusEndsAt: clearDeskFocus().endsAt });
      },
      scheduleReminder: async ({ delaySeconds, message }) => {
        await this.schedule(delaySeconds, 'deliverReminder', { message });
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
    });

    try {
      this.#pendingConfirmation = await executeApolloTurn(
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
          session: this.session,
          deviceId,
          effects: deskToolEffects,
          isSpeechAborted: () => this.#isSpeechAborted,
          ...(this.#lastTelemetrySnapshot !== undefined
            ? { telemetrySnapshot: this.#lastTelemetrySnapshot }
            : {}),
        },
        turnPart,
      );
      if (this.#pendingConfirmation !== undefined) {
        await savePendingToolConfirmation(this.#sqlExecutor(), this.#pendingConfirmation);
      }
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
  const requestUrl = new URL(request.url);
  const isAuthorized = await isDeviceSharedSecretValid(
    readDeviceTokenFromRequestUrl(requestUrl),
    environment.DEVICE_SHARED_SECRET,
  );
  if (!isAuthorized) {
    return new Response('Unauthorized', { status: 401 });
  }
  return undefined;
}
