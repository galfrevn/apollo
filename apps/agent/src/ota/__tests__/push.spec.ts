import { describe, expect, it } from 'bun:test';

import {
  buildFirmwareChangelogMessage,
  compareFirmwareVersions,
  detectFirmwareVersionChange,
  evaluateFirmwarePush,
  FIRMWARE_PUSH_CHECK_INTERVAL_MS,
  FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION,
  FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT,
  FIRMWARE_PUSH_RETRY_COOLDOWN_MS,
  parseStoredFirmwareChangelogState,
  parseStoredFirmwarePushState,
  recordFirmwareManifestCheck,
  recordFirmwarePushAttempt,
  shouldCheckFirmwareManifest,
  type FirmwarePushState,
} from '@/ota/push';
import type { DeskTelemetrySnapshot } from '@/telemetry/logic';

const NOW_MILLISECONDS = 1_786_540_000_000;

function createSnapshot(
  overrides: Partial<DeskTelemetrySnapshot> = {},
): DeskTelemetrySnapshot {
  return {
    battery: 90,
    charging: true,
    firmwareVersion: '2.6.0',
    receivedAtMs: NOW_MILLISECONDS,
    ...overrides,
  };
}

function createPushEvaluationInput(
  overrides: Partial<Parameters<typeof evaluateFirmwarePush>[0]> = {},
): Parameters<typeof evaluateFirmwarePush>[0] {
  return {
    snapshot: createSnapshot(),
    manifestVersion: '2.7.0',
    uiState: 'idle',
    isFocusActive: false,
    hasPendingConfirmation: false,
    isAnnouncementInFlight: false,
    pushState: undefined,
    nowMilliseconds: NOW_MILLISECONDS,
    ...overrides,
  };
}

function createPushState(overrides: Partial<FirmwarePushState> = {}): FirmwarePushState {
  return {
    attemptCount: 0,
    lastCheckedAtMilliseconds: NOW_MILLISECONDS,
    ...overrides,
  };
}

describe('compareFirmwareVersions', () => {
  it('orders plain numeric versions', () => {
    expect(compareFirmwareVersions('2.7.0', '2.6.0')).toBeGreaterThan(0);
    expect(compareFirmwareVersions('2.6.0', '2.7.0')).toBeLessThan(0);
    expect(compareFirmwareVersions('2.6.0', '2.6.0')).toBe(0);
  });

  it('compares segments numerically, not lexically', () => {
    expect(compareFirmwareVersions('2.10.0', '2.9.9')).toBeGreaterThan(0);
  });

  it('treats the longer version as newer on a tie prefix', () => {
    expect(compareFirmwareVersions('2.6.0', '2.6')).toBeGreaterThan(0);
    expect(compareFirmwareVersions('2.6', '2.6.0')).toBeLessThan(0);
  });
});

describe('shouldCheckFirmwareManifest', () => {
  it('checks with no prior state', () => {
    expect(
      shouldCheckFirmwareManifest({
        pushState: undefined,
        didChargingEdgeOccur: false,
        nowMilliseconds: NOW_MILLISECONDS,
      }),
    ).toBe(true);
  });

  it('throttles inside the check interval', () => {
    expect(
      shouldCheckFirmwareManifest({
        pushState: createPushState({
          lastCheckedAtMilliseconds:
            NOW_MILLISECONDS - FIRMWARE_PUSH_CHECK_INTERVAL_MS + 1,
        }),
        didChargingEdgeOccur: false,
        nowMilliseconds: NOW_MILLISECONDS,
      }),
    ).toBe(false);
  });

  it('checks again once the interval elapses', () => {
    expect(
      shouldCheckFirmwareManifest({
        pushState: createPushState({
          lastCheckedAtMilliseconds: NOW_MILLISECONDS - FIRMWARE_PUSH_CHECK_INTERVAL_MS,
        }),
        didChargingEdgeOccur: false,
        nowMilliseconds: NOW_MILLISECONDS,
      }),
    ).toBe(true);
  });

  it('bypasses the throttle on a charging edge', () => {
    expect(
      shouldCheckFirmwareManifest({
        pushState: createPushState({ lastCheckedAtMilliseconds: NOW_MILLISECONDS }),
        didChargingEdgeOccur: true,
        nowMilliseconds: NOW_MILLISECONDS,
      }),
    ).toBe(true);
  });
});

describe('evaluateFirmwarePush', () => {
  it('pushes a newer version in the safe window', () => {
    expect(evaluateFirmwarePush(createPushEvaluationInput())).toEqual({
      shouldPush: true,
    });
  });

  it('skips without a reported firmware version', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        snapshot: createSnapshot({ firmwareVersion: undefined }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'no_reported_version' });
  });

  it('skips when the device is already current', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ manifestVersion: '2.6.0' }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'already_current' });
  });

  it('skips when the device runs a version newer than the manifest', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ manifestVersion: '2.5.0' }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'already_current' });
  });

  it('skips outside the safe ui states', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ uiState: 'speaking' }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'unsafe_ui_state' });
  });

  it('allows the dashboard as a safe ui state', () => {
    expect(
      evaluateFirmwarePush(createPushEvaluationInput({ uiState: 'dashboard' })),
    ).toEqual({ shouldPush: true });
  });

  it('skips with a confirmation pending', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ hasPendingConfirmation: true }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'confirm_pending' });
  });

  it('skips while an announcement is in flight', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ isAnnouncementInFlight: true }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'announcement_in_flight' });
  });

  it('skips during focus', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({ isFocusActive: true }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'focus_active' });
  });

  it('skips on battery below the minimum when not charging', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        snapshot: createSnapshot({
          charging: false,
          battery: FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT - 1,
        }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'insufficient_power' });
  });

  it('accepts a full battery without charging', () => {
    expect(
      evaluateFirmwarePush(
        createPushEvaluationInput({
          snapshot: createSnapshot({
            charging: false,
            battery: FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT,
          }),
        }),
      ),
    ).toEqual({ shouldPush: true });
  });

  it('skips without any power reading', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        snapshot: createSnapshot({ charging: undefined, battery: undefined }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'insufficient_power' });
  });

  it('cools down between attempts at the same version', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        pushState: createPushState({
          attemptedVersion: '2.7.0',
          attemptedAtMilliseconds: NOW_MILLISECONDS - FIRMWARE_PUSH_RETRY_COOLDOWN_MS + 1,
          attemptCount: 1,
        }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'retry_cooldown' });
  });

  it('retries the same version once the cooldown elapses', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        pushState: createPushState({
          attemptedVersion: '2.7.0',
          attemptedAtMilliseconds: NOW_MILLISECONDS - FIRMWARE_PUSH_RETRY_COOLDOWN_MS,
          attemptCount: 1,
        }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: true });
  });

  it('gives up on a version after the attempt limit', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        pushState: createPushState({
          attemptedVersion: '2.7.0',
          attemptedAtMilliseconds: NOW_MILLISECONDS - 2 * FIRMWARE_PUSH_RETRY_COOLDOWN_MS,
          attemptCount: FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION,
        }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: false, reason: 'attempt_limit' });
  });

  it('resets the attempt policy for a new manifest version', () => {
    const evaluation = evaluateFirmwarePush(
      createPushEvaluationInput({
        manifestVersion: '2.8.0',
        pushState: createPushState({
          attemptedVersion: '2.7.0',
          attemptedAtMilliseconds: NOW_MILLISECONDS - 1,
          attemptCount: FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION,
        }),
      }),
    );
    expect(evaluation).toEqual({ shouldPush: true });
  });
});

describe('recordFirmwarePushAttempt', () => {
  it('starts the counter for a first attempt', () => {
    const nextState = recordFirmwarePushAttempt(undefined, '2.7.0', NOW_MILLISECONDS);
    expect(nextState).toEqual({
      attemptedVersion: '2.7.0',
      attemptedAtMilliseconds: NOW_MILLISECONDS,
      attemptCount: 1,
      lastCheckedAtMilliseconds: NOW_MILLISECONDS,
    });
  });

  it('increments the counter for a retry of the same version', () => {
    const nextState = recordFirmwarePushAttempt(
      createPushState({
        attemptedVersion: '2.7.0',
        attemptedAtMilliseconds: NOW_MILLISECONDS - 1,
        attemptCount: 2,
      }),
      '2.7.0',
      NOW_MILLISECONDS,
    );
    expect(nextState.attemptCount).toBe(3);
  });

  it('resets the counter for a new version', () => {
    const nextState = recordFirmwarePushAttempt(
      createPushState({
        attemptedVersion: '2.7.0',
        attemptedAtMilliseconds: NOW_MILLISECONDS - 1,
        attemptCount: 3,
      }),
      '2.8.0',
      NOW_MILLISECONDS,
    );
    expect(nextState.attemptCount).toBe(1);
    expect(nextState.attemptedVersion).toBe('2.8.0');
  });
});

describe('recordFirmwareManifestCheck', () => {
  it('stamps the check time preserving attempt history', () => {
    const nextState = recordFirmwareManifestCheck(
      createPushState({
        attemptedVersion: '2.7.0',
        attemptedAtMilliseconds: NOW_MILLISECONDS - 10,
        attemptCount: 2,
        lastCheckedAtMilliseconds: NOW_MILLISECONDS - 10,
      }),
      NOW_MILLISECONDS,
    );
    expect(nextState).toEqual({
      attemptedVersion: '2.7.0',
      attemptedAtMilliseconds: NOW_MILLISECONDS - 10,
      attemptCount: 2,
      lastCheckedAtMilliseconds: NOW_MILLISECONDS,
    });
  });
});

describe('detectFirmwareVersionChange', () => {
  it('detects a real upgrade edge', () => {
    expect(
      detectFirmwareVersionChange({
        previousFirmwareVersion: '2.6.0',
        nextFirmwareVersion: '2.7.0',
      }),
    ).toEqual({ fromVersion: '2.6.0', toVersion: '2.7.0' });
  });

  it('ignores a rollback', () => {
    expect(
      detectFirmwareVersionChange({
        previousFirmwareVersion: '2.7.0',
        nextFirmwareVersion: '2.6.0',
      }),
    ).toBeUndefined();
  });

  it('ignores an unchanged version', () => {
    expect(
      detectFirmwareVersionChange({
        previousFirmwareVersion: '2.6.0',
        nextFirmwareVersion: '2.6.0',
      }),
    ).toBeUndefined();
  });

  it('ignores missing versions on either side', () => {
    expect(
      detectFirmwareVersionChange({
        previousFirmwareVersion: undefined,
        nextFirmwareVersion: '2.7.0',
      }),
    ).toBeUndefined();
    expect(
      detectFirmwareVersionChange({
        previousFirmwareVersion: '2.6.0',
        nextFirmwareVersion: undefined,
      }),
    ).toBeUndefined();
  });
});

describe('buildFirmwareChangelogMessage', () => {
  it('speaks the changelog when present', () => {
    expect(
      buildFirmwareChangelogMessage({
        toVersion: '2.7.0',
        changelogText: 'ahora la cuenta regresiva se ve en el aro.',
      }),
    ).toBe('Me actualicé al firmware 2.7.0: ahora la cuenta regresiva se ve en el aro.');
  });

  it('falls back to a generic sentence without a changelog', () => {
    expect(buildFirmwareChangelogMessage({ toVersion: '2.7.0' })).toBe(
      'Me actualicé al firmware 2.7.0 mientras no me usabas.',
    );
  });
});

describe('stored state parsers', () => {
  it('round-trip the push state', () => {
    const pushState = createPushState({
      attemptedVersion: '2.7.0',
      attemptedAtMilliseconds: NOW_MILLISECONDS,
      attemptCount: 1,
    });
    expect(parseStoredFirmwarePushState(JSON.stringify(pushState))).toEqual(pushState);
  });

  it('round-trip the changelog state', () => {
    const changelogState = { pendingVersion: '2.7.0', announcedVersion: '2.6.0' };
    expect(parseStoredFirmwareChangelogState(JSON.stringify(changelogState))).toEqual(
      changelogState,
    );
  });

  it('reject garbage', () => {
    expect(parseStoredFirmwarePushState('{"attemptCount":')).toBeUndefined();
    expect(parseStoredFirmwarePushState('{"attemptCount":1}')).toBeUndefined();
    expect(parseStoredFirmwareChangelogState('null')).toBeUndefined();
  });
});
