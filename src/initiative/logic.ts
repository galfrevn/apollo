import { z } from 'zod';

import { APOLLO_TIME_ZONE } from '@/persona/clock';
import type { DeskSoundEffectName } from '@/protocol/schema';

export const initiativeSourceSchema = z.enum([
  'firmware_changelog',
  'low_battery',
  'curiosity',
  'follow_up',
  'sentinel',
]);

export type InitiativeSource = z.infer<typeof initiativeSourceSchema>;

export const initiativePrioritySchema = z.enum(['critical', 'normal', 'low']);

export type InitiativePriority = z.infer<typeof initiativePrioritySchema>;

const initiativeStateSchema = z.object({
  budgetDate: z.string().min(1),
  utterancesUsed: z.number().int().min(0),
  lastUtteranceAtBySource: z.record(z.string(), z.number()),
});

export type InitiativeState = {
  readonly budgetDate: string;
  readonly utterancesUsed: number;
  readonly lastUtteranceAtBySource: Readonly<Record<string, number>>;
};

export type InitiativeDeliveryOutcome = 'delivered' | 'suppressed' | 'deferred';

export type InitiativeUtteranceInput = {
  readonly source: InitiativeSource;
  readonly priority: InitiativePriority;
  readonly message: string;
  readonly earconName?: DeskSoundEffectName;
  readonly deferCount?: number;
};

export type InitiativeDecision =
  | { readonly action: 'deliver' }
  | {
      readonly action: 'suppress';
      readonly reason:
        | 'budget_exhausted'
        | 'source_cooldown'
        | 'device_offline'
        | 'defer_limit';
    }
  | {
      readonly action: 'defer';
      readonly reason: 'quiet_hours' | 'focus_active';
      readonly retryAtMilliseconds: number;
    };

export const INITIATIVE_QUIET_HOURS_START_HOUR = 22;
export const INITIATIVE_QUIET_HOURS_END_HOUR = 9;
export const INITIATIVE_DAILY_UTTERANCE_BUDGET = 6;
export const INITIATIVE_SOURCE_COOLDOWN_MS = 60 * 60_000;
export const INITIATIVE_MAX_DEFER_COUNT = 2;
export const INITIATIVE_FOCUS_DEFER_GRACE_MS = 60_000;
// A deferred utterance whose retry lands in a suppressing moment (device
// offline at 09:00, budget spent) re-schedules itself instead of vanishing;
// this bounds that loop.
export const INITIATIVE_MAX_RETRY_ATTEMPTS = 5;
export const INITIATIVE_SUPPRESSED_RETRY_DELAY_SECONDS = 30 * 60;

type LocalTimeParts = {
  readonly calendarDate: string;
  readonly secondsSinceLocalMidnight: number;
};

// Argentina has no DST, but resolving through Intl instead of a fixed offset
// keeps this correct if the country ever reinstates it.
function resolveLocalTimeParts(nowMilliseconds: number): LocalTimeParts {
  const formattedPartList = new Intl.DateTimeFormat('en-CA', {
    timeZone: APOLLO_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(nowMilliseconds));
  const partValueByType = new Map(
    formattedPartList.map((formattedPart) => [formattedPart.type, formattedPart.value]),
  );
  // Intl reports midnight as hour "24" in some runtimes; normalize it to 0.
  const localHour = Number(partValueByType.get('hour')) % 24;
  const localMinute = Number(partValueByType.get('minute'));
  const localSecond = Number(partValueByType.get('second'));
  return {
    calendarDate: `${partValueByType.get('year')}-${partValueByType.get('month')}-${partValueByType.get('day')}`,
    secondsSinceLocalMidnight: localHour * 3600 + localMinute * 60 + localSecond,
  };
}

export function resolveLocalCalendarDate(nowMilliseconds: number): string {
  return resolveLocalTimeParts(nowMilliseconds).calendarDate;
}

export function isWithinQuietHours(nowMilliseconds: number): boolean {
  const localHour = Math.floor(
    resolveLocalTimeParts(nowMilliseconds).secondsSinceLocalMidnight / 3600,
  );
  return (
    localHour >= INITIATIVE_QUIET_HOURS_START_HOUR ||
    localHour < INITIATIVE_QUIET_HOURS_END_HOUR
  );
}

export function computeQuietHoursEndMilliseconds(nowMilliseconds: number): number {
  const { secondsSinceLocalMidnight } = resolveLocalTimeParts(nowMilliseconds);
  const quietHoursEndSeconds = INITIATIVE_QUIET_HOURS_END_HOUR * 3600;
  const secondsUntilQuietHoursEnd =
    secondsSinceLocalMidnight < quietHoursEndSeconds
      ? quietHoursEndSeconds - secondsSinceLocalMidnight
      : 24 * 3600 - secondsSinceLocalMidnight + quietHoursEndSeconds;
  return nowMilliseconds + secondsUntilQuietHoursEnd * 1000;
}

export type InitiativeCandidateEvaluationInput = {
  readonly source: InitiativeSource;
  readonly priority: InitiativePriority;
  readonly state: InitiativeState | undefined;
  readonly nowMilliseconds: number;
  readonly focusEndsAtMilliseconds: number | null;
  readonly connectionCount: number;
  readonly deferCount: number;
};

export function evaluateInitiativeCandidate(
  input: InitiativeCandidateEvaluationInput,
): InitiativeDecision {
  const { state, nowMilliseconds } = input;
  // With nobody connected the notify layer would enqueue a card that is
  // replayed silently on reconnect — self-initiated speech arriving as a stale
  // mute card is worse than not speaking, and shouldn't burn budget. This
  // outranks critical: suppressing keeps the caller's cooldown unwritten, so
  // the utterance retries promptly once the device reconnects.
  if (input.connectionCount === 0) {
    return { action: 'suppress', reason: 'device_offline' };
  }
  if (input.priority === 'critical') {
    return { action: 'deliver' };
  }
  if (isWithinQuietHours(nowMilliseconds)) {
    if (input.deferCount >= INITIATIVE_MAX_DEFER_COUNT) {
      return { action: 'suppress', reason: 'defer_limit' };
    }
    return {
      action: 'defer',
      reason: 'quiet_hours',
      retryAtMilliseconds: computeQuietHoursEndMilliseconds(nowMilliseconds),
    };
  }
  const isFocusActive =
    input.focusEndsAtMilliseconds !== null &&
    input.focusEndsAtMilliseconds > nowMilliseconds;
  if (isFocusActive && input.focusEndsAtMilliseconds !== null) {
    if (input.deferCount >= INITIATIVE_MAX_DEFER_COUNT) {
      return { action: 'suppress', reason: 'defer_limit' };
    }
    // The notify layer would deliver during focus as a silent card; deferring
    // past the focus window preserves the spoken half of the utterance.
    return {
      action: 'defer',
      reason: 'focus_active',
      retryAtMilliseconds:
        input.focusEndsAtMilliseconds + INITIATIVE_FOCUS_DEFER_GRACE_MS,
    };
  }
  const isBudgetExhausted =
    state !== undefined &&
    state.budgetDate === resolveLocalCalendarDate(nowMilliseconds) &&
    state.utterancesUsed >= INITIATIVE_DAILY_UTTERANCE_BUDGET;
  if (isBudgetExhausted) {
    return { action: 'suppress', reason: 'budget_exhausted' };
  }
  const lastUtteranceAtMilliseconds = state?.lastUtteranceAtBySource[input.source];
  const isSourceCoolingDown =
    lastUtteranceAtMilliseconds !== undefined &&
    nowMilliseconds - lastUtteranceAtMilliseconds < INITIATIVE_SOURCE_COOLDOWN_MS;
  if (isSourceCoolingDown) {
    return { action: 'suppress', reason: 'source_cooldown' };
  }
  return { action: 'deliver' };
}

export function recordInitiativeDelivery(
  state: InitiativeState | undefined,
  source: InitiativeSource,
  priority: InitiativePriority,
  nowMilliseconds: number,
): InitiativeState {
  const currentCalendarDate = resolveLocalCalendarDate(nowMilliseconds);
  const utterancesUsedToday =
    state !== undefined && state.budgetDate === currentCalendarDate
      ? state.utterancesUsed
      : 0;
  // Critical utterances bypass the budget on evaluation, so counting them here
  // would let a low-battery night starve the next day's normal utterances.
  const shouldCountAgainstBudget = priority !== 'critical';
  return {
    budgetDate: currentCalendarDate,
    utterancesUsed: utterancesUsedToday + (shouldCountAgainstBudget ? 1 : 0),
    lastUtteranceAtBySource: {
      ...state?.lastUtteranceAtBySource,
      [source]: nowMilliseconds,
    },
  };
}

export function parseStoredInitiativeState(
  storedValue: string,
): InitiativeState | undefined {
  try {
    const parsedState = initiativeStateSchema.safeParse(JSON.parse(storedValue));
    return parsedState.success ? parsedState.data : undefined;
  } catch {
    return undefined;
  }
}
