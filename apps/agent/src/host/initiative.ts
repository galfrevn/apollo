import { deliverDeskDeviceNotification } from '@/agents/notify';
import type { AnnounceableConnection } from '@/agents/notify';
import { retryInitiativeUtterancePayloadSchema } from '@/agents/rpc';
import { APOLLO_TTS_VOICE } from '@/configuration/identity';
import type { DeskFocusState } from '@/focus/logic';
import {
  buildInitiativeDeliveryMarkerKey,
  evaluateInitiativeCandidate,
  INITIATIVE_MAX_RETRY_ATTEMPTS,
  INITIATIVE_SUPPRESSED_RETRY_DELAY_SECONDS,
  parseStoredInitiativeState,
  recordInitiativeDelivery,
  type InitiativeDeliveryOutcome,
  type InitiativeUtteranceInput,
} from '@/initiative/logic';
import { getSessionPreference, setSessionPreference } from '@/memory/store';
import type { MemorySqlExecutor } from '@/memory/store';
import type { BlobStore } from '@/platform/blob';
import type { HostScheduler } from '@/platform/bun/scheduler';
import type { DeskSoundEffectName } from '@/protocol/schema';
import {
  evaluateLowBatteryAnnouncement,
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';

// The same preference keys the durable object writes, so a migrated database
// keeps its budget, cooldowns, and delivery markers.
const INITIATIVE_STATE_PREFERENCE_KEY = 'initiativeState';
const LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY = 'lowBatteryLastAnnounceAt';

export type HostInitiativeEngineDependencies = {
  readonly deviceName: string;
  readonly environment: Env;
  readonly sqlExecutor: MemorySqlExecutor;
  readonly scheduler: HostScheduler;
  readonly mediaBlobStore: BlobStore;
  readonly getFocusEndsAt: () => number | null;
  readonly currentFocusState: () => DeskFocusState;
  readonly getDeviceConnectionList: () => readonly AnnounceableConnection[];
  readonly playEffect: (effectName: DeskSoundEffectName) => void;
};

export function createHostInitiativeEngine(
  dependencies: HostInitiativeEngineDependencies,
) {
  const { sqlExecutor, scheduler, environment } = dependencies;
  let isDeliveringInitiative = false;
  let isAnnouncingLowBattery = false;

  async function deliverInitiativeUtterance(
    input: InitiativeUtteranceInput & { readonly deferCount?: number },
  ): Promise<InitiativeDeliveryOutcome> {
    const nowMilliseconds = Date.now();
    const storedInitiativeState = await getSessionPreference(
      sqlExecutor,
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
      focusEndsAtMilliseconds: dependencies.getFocusEndsAt(),
      connectionCount: dependencies.getDeviceConnectionList().length,
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
      await scheduler.schedule(retryDelaySeconds, 'retryInitiativeUtterance', {
        source: input.source,
        priority: input.priority,
        message: input.message,
        earconName: input.earconName,
        utteranceKey: input.utteranceKey,
        deferCount,
      });
      return 'deferred';
    }
    if (decision.action === 'suppress' || isDeliveringInitiative) {
      return 'suppressed';
    }
    isDeliveringInitiative = true;
    try {
      if (input.earconName !== undefined) {
        dependencies.playEffect(input.earconName);
      }
      await deliverDeskDeviceNotification({
        notification: { type: 'reminder', message: input.message },
        connectionList: dependencies.getDeviceConnectionList(),
        sqlExecutor,
        focusState: dependencies.currentFocusState(),
        environment,
        mediaBlobStore: dependencies.mediaBlobStore,
        deviceId: dependencies.deviceName,
        ttsVoiceId: APOLLO_TTS_VOICE,
        isMockVoice: environment.MOCK_VOICE === '1',
        announceKind: input.priority === 'critical' ? 'critical' : undefined,
      });
      // Recorded only after delivery succeeds, so a failed delivery neither
      // consumes budget nor starts the source cooldown.
      await setSessionPreference(
        sqlExecutor,
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
          sqlExecutor,
          buildInitiativeDeliveryMarkerKey(input.utteranceKey),
          String(nowMilliseconds),
        );
      }
    } finally {
      isDeliveringInitiative = false;
    }
    return 'delivered';
  }

  return {
    deliverInitiativeUtterance,
    isAnnouncementInFlight: () => isDeliveringInitiative || isAnnouncingLowBattery,

    async retryInitiativeUtterance(rawPayload: unknown): Promise<void> {
      const parsedPayload = retryInitiativeUtterancePayloadSchema.parse(rawPayload);
      const nextDeferCount = parsedPayload.deferCount + 1;
      const retryPayload = {
        source: parsedPayload.source,
        priority: parsedPayload.priority,
        message: parsedPayload.message,
        earconName: parsedPayload.earconName,
        utteranceKey: parsedPayload.utteranceKey,
        deferCount: nextDeferCount,
      };
      const deliveryOutcome = await deliverInitiativeUtterance(retryPayload);
      // A deferred utterance already survived one policy window; letting its
      // retry vanish on a transient suppression would lose it for good — so
      // it re-schedules itself, bounded by the attempt cap.
      if (
        deliveryOutcome === 'suppressed' &&
        nextDeferCount < INITIATIVE_MAX_RETRY_ATTEMPTS
      ) {
        await scheduler.schedule(
          INITIATIVE_SUPPRESSED_RETRY_DELAY_SECONDS,
          'retryInitiativeUtterance',
          retryPayload,
        );
      }
    },

    async handleLowBatteryAnnouncement(snapshot: DeskTelemetrySnapshot): Promise<void> {
      const storedAnnounceAt = await getSessionPreference(
        sqlExecutor,
        LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
      );
      const parsedAnnounceAt = Number(storedAnnounceAt);
      const lastAnnounceAtMilliseconds =
        Number.isFinite(parsedAnnounceAt) && parsedAnnounceAt > 0
          ? parsedAnnounceAt
          : null;
      const evaluation = evaluateLowBatteryAnnouncement({
        snapshot,
        lastAnnounceAtMilliseconds,
        nowMilliseconds: Date.now(),
      });
      if (evaluation.shouldRearm) {
        await setSessionPreference(sqlExecutor, LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY, '0');
      }
      if (!evaluation.shouldAnnounce || evaluation.message === undefined) {
        return;
      }
      // The cooldown is only persisted after delivery succeeds, so a failure
      // retries on the next telemetry instead of going silent for half an
      // hour; the in-flight flag keeps a mid-announcement telemetry tick from
      // reading the still-expired cooldown.
      if (isAnnouncingLowBattery) {
        return;
      }
      isAnnouncingLowBattery = true;
      try {
        const deliveryOutcome = await deliverInitiativeUtterance({
          source: 'low_battery',
          priority: 'critical',
          message: evaluation.message,
          earconName: 'low_battery',
        });
        if (deliveryOutcome === 'delivered') {
          await setSessionPreference(
            sqlExecutor,
            LOW_BATTERY_ANNOUNCE_PREFERENCE_KEY,
            String(Date.now()),
          );
        }
      } finally {
        isAnnouncingLowBattery = false;
      }
    },
  };
}

export type HostInitiativeEngine = ReturnType<typeof createHostInitiativeEngine>;
