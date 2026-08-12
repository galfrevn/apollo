import { describe, expect, it } from 'bun:test';

import {
  computeQuietHoursEndMilliseconds,
  evaluateInitiativeCandidate,
  INITIATIVE_DAILY_UTTERANCE_BUDGET,
  INITIATIVE_FOCUS_DEFER_GRACE_MS,
  INITIATIVE_MAX_DEFER_COUNT,
  INITIATIVE_SOURCE_COOLDOWN_MS,
  isWithinQuietHours,
  parseStoredInitiativeState,
  recordInitiativeDelivery,
  resolveLocalCalendarDate,
  type InitiativeCandidateEvaluationInput,
  type InitiativeState,
} from '@/initiative/logic';

// Buenos Aires sits at UTC-3 year-round (no DST), so local wall time maps to
// UTC by adding three hours.
function buildBuenosAiresEpochMilliseconds(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute = 0,
  second = 0,
): number {
  return Date.UTC(year, monthIndex, day, hour + 3, minute, second);
}

const DAYTIME_MILLISECONDS = buildBuenosAiresEpochMilliseconds(2026, 7, 11, 15, 30);

function createEvaluationInput(
  overrides: Partial<InitiativeCandidateEvaluationInput> = {},
): InitiativeCandidateEvaluationInput {
  return {
    source: 'firmware_changelog',
    priority: 'normal',
    state: undefined,
    nowMilliseconds: DAYTIME_MILLISECONDS,
    focusEndsAtMilliseconds: null,
    connectionCount: 1,
    deferCount: 0,
    ...overrides,
  };
}

function createState(overrides: Partial<InitiativeState> = {}): InitiativeState {
  return {
    budgetDate: resolveLocalCalendarDate(DAYTIME_MILLISECONDS),
    utterancesUsed: 0,
    lastUtteranceAtBySource: {},
    ...overrides,
  };
}

describe('isWithinQuietHours', () => {
  it('is outside quiet hours just before they start', () => {
    expect(
      isWithinQuietHours(buildBuenosAiresEpochMilliseconds(2026, 7, 11, 21, 59)),
    ).toBe(false);
  });

  it('enters quiet hours exactly at the start hour', () => {
    expect(
      isWithinQuietHours(buildBuenosAiresEpochMilliseconds(2026, 7, 11, 22, 0)),
    ).toBe(true);
  });

  it('is still quiet just before the end hour', () => {
    expect(
      isWithinQuietHours(buildBuenosAiresEpochMilliseconds(2026, 7, 12, 8, 59)),
    ).toBe(true);
  });

  it('leaves quiet hours exactly at the end hour', () => {
    expect(isWithinQuietHours(buildBuenosAiresEpochMilliseconds(2026, 7, 12, 9, 0))).toBe(
      false,
    );
  });

  it('is quiet in the middle of the night', () => {
    expect(isWithinQuietHours(buildBuenosAiresEpochMilliseconds(2026, 7, 12, 3, 0))).toBe(
      true,
    );
  });
});

describe('computeQuietHoursEndMilliseconds', () => {
  it('targets the same morning during the early hours', () => {
    const nowMilliseconds = buildBuenosAiresEpochMilliseconds(2026, 7, 12, 3, 15, 30);
    expect(computeQuietHoursEndMilliseconds(nowMilliseconds)).toBe(
      buildBuenosAiresEpochMilliseconds(2026, 7, 12, 9, 0),
    );
  });

  it('targets the next morning during the late evening', () => {
    const nowMilliseconds = buildBuenosAiresEpochMilliseconds(2026, 7, 11, 23, 0);
    expect(computeQuietHoursEndMilliseconds(nowMilliseconds)).toBe(
      buildBuenosAiresEpochMilliseconds(2026, 7, 12, 9, 0),
    );
  });
});

describe('resolveLocalCalendarDate', () => {
  it('uses the Buenos Aires date, not the UTC date', () => {
    // 22:00 local on the 11th is already the 12th in UTC.
    expect(
      resolveLocalCalendarDate(buildBuenosAiresEpochMilliseconds(2026, 7, 11, 22, 0)),
    ).toBe('2026-08-11');
  });
});

describe('evaluateInitiativeCandidate', () => {
  it('delivers with no prior state during the day', () => {
    expect(evaluateInitiativeCandidate(createEvaluationInput())).toEqual({
      action: 'deliver',
    });
  });

  it('delivers critical candidates through quiet hours, budget, and cooldown', () => {
    const nightMilliseconds = buildBuenosAiresEpochMilliseconds(2026, 7, 12, 3, 0);
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        priority: 'critical',
        source: 'low_battery',
        nowMilliseconds: nightMilliseconds,
        state: createState({
          budgetDate: resolveLocalCalendarDate(nightMilliseconds),
          utterancesUsed: INITIATIVE_DAILY_UTTERANCE_BUDGET,
          lastUtteranceAtBySource: { low_battery: nightMilliseconds - 1 },
        }),
      }),
    );
    expect(decision).toEqual({ action: 'deliver' });
  });

  it('suppresses when the device is offline', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({ connectionCount: 0 }),
    );
    expect(decision).toEqual({ action: 'suppress', reason: 'device_offline' });
  });

  it('suppresses even critical candidates while offline, so cooldowns stay unwritten', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({ priority: 'critical', connectionCount: 0 }),
    );
    expect(decision).toEqual({ action: 'suppress', reason: 'device_offline' });
  });

  it('defers to the end of quiet hours at night', () => {
    const nowMilliseconds = buildBuenosAiresEpochMilliseconds(2026, 7, 11, 23, 30);
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({ nowMilliseconds }),
    );
    expect(decision).toEqual({
      action: 'defer',
      reason: 'quiet_hours',
      retryAtMilliseconds: buildBuenosAiresEpochMilliseconds(2026, 7, 12, 9, 0),
    });
  });

  it('suppresses instead of deferring past the defer limit', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        nowMilliseconds: buildBuenosAiresEpochMilliseconds(2026, 7, 11, 23, 30),
        deferCount: INITIATIVE_MAX_DEFER_COUNT,
      }),
    );
    expect(decision).toEqual({ action: 'suppress', reason: 'defer_limit' });
  });

  it('defers past an active focus window with grace', () => {
    const focusEndsAtMilliseconds = DAYTIME_MILLISECONDS + 10 * 60_000;
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({ focusEndsAtMilliseconds }),
    );
    expect(decision).toEqual({
      action: 'defer',
      reason: 'focus_active',
      retryAtMilliseconds: focusEndsAtMilliseconds + INITIATIVE_FOCUS_DEFER_GRACE_MS,
    });
  });

  it('ignores an already-expired focus window', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        focusEndsAtMilliseconds: DAYTIME_MILLISECONDS - 1,
      }),
    );
    expect(decision).toEqual({ action: 'deliver' });
  });

  it('suppresses once the daily budget is exhausted', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        state: createState({ utterancesUsed: INITIATIVE_DAILY_UTTERANCE_BUDGET }),
      }),
    );
    expect(decision).toEqual({ action: 'suppress', reason: 'budget_exhausted' });
  });

  it('rolls the budget over on a new local day', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        state: createState({
          budgetDate: '2026-08-10',
          utterancesUsed: INITIATIVE_DAILY_UTTERANCE_BUDGET,
        }),
      }),
    );
    expect(decision).toEqual({ action: 'deliver' });
  });

  it('suppresses a source still inside its cooldown', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        state: createState({
          lastUtteranceAtBySource: {
            firmware_changelog: DAYTIME_MILLISECONDS - INITIATIVE_SOURCE_COOLDOWN_MS + 1,
          },
        }),
      }),
    );
    expect(decision).toEqual({ action: 'suppress', reason: 'source_cooldown' });
  });

  it('lets a different source speak during another source cooldown', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        source: 'curiosity',
        state: createState({
          lastUtteranceAtBySource: {
            firmware_changelog: DAYTIME_MILLISECONDS - 1,
          },
        }),
      }),
    );
    expect(decision).toEqual({ action: 'deliver' });
  });

  it('delivers again once the source cooldown expires', () => {
    const decision = evaluateInitiativeCandidate(
      createEvaluationInput({
        state: createState({
          lastUtteranceAtBySource: {
            firmware_changelog: DAYTIME_MILLISECONDS - INITIATIVE_SOURCE_COOLDOWN_MS,
          },
        }),
      }),
    );
    expect(decision).toEqual({ action: 'deliver' });
  });
});

describe('recordInitiativeDelivery', () => {
  it('starts a fresh day from undefined state', () => {
    const nextState = recordInitiativeDelivery(
      undefined,
      'firmware_changelog',
      'normal',
      DAYTIME_MILLISECONDS,
    );
    expect(nextState).toEqual({
      budgetDate: '2026-08-11',
      utterancesUsed: 1,
      lastUtteranceAtBySource: { firmware_changelog: DAYTIME_MILLISECONDS },
    });
  });

  it('increments the same-day counter and keeps other source timestamps', () => {
    const nextState = recordInitiativeDelivery(
      createState({
        utterancesUsed: 2,
        lastUtteranceAtBySource: { low_battery: DAYTIME_MILLISECONDS - 5_000 },
      }),
      'curiosity',
      'normal',
      DAYTIME_MILLISECONDS,
    );
    expect(nextState.utterancesUsed).toBe(3);
    expect(nextState.lastUtteranceAtBySource).toEqual({
      low_battery: DAYTIME_MILLISECONDS - 5_000,
      curiosity: DAYTIME_MILLISECONDS,
    });
  });

  it('resets the counter across a local day boundary', () => {
    const nextState = recordInitiativeDelivery(
      createState({ budgetDate: '2026-08-10', utterancesUsed: 6 }),
      'firmware_changelog',
      'normal',
      DAYTIME_MILLISECONDS,
    );
    expect(nextState.budgetDate).toBe('2026-08-11');
    expect(nextState.utterancesUsed).toBe(1);
  });

  it('records a critical delivery without consuming budget', () => {
    const nextState = recordInitiativeDelivery(
      createState({ utterancesUsed: 2 }),
      'low_battery',
      'critical',
      DAYTIME_MILLISECONDS,
    );
    expect(nextState.utterancesUsed).toBe(2);
    expect(nextState.lastUtteranceAtBySource).toEqual({
      low_battery: DAYTIME_MILLISECONDS,
    });
  });
});

describe('parseStoredInitiativeState', () => {
  it('restores a stored state', () => {
    const state = createState({ utterancesUsed: 3 });
    expect(parseStoredInitiativeState(JSON.stringify(state))).toEqual(state);
  });

  it('rejects malformed json', () => {
    expect(parseStoredInitiativeState('{"budgetDate":')).toBeUndefined();
  });

  it('rejects json with the wrong shape', () => {
    expect(parseStoredInitiativeState('{"budgetDate":"2026-08-11"}')).toBeUndefined();
    expect(parseStoredInitiativeState('null')).toBeUndefined();
  });
});
