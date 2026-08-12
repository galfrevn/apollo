import { z } from 'zod';

import type { DeskTelemetrySnapshot } from '@/telemetry/logic';

export const FIRMWARE_PUSH_CHECK_INTERVAL_MS = 15 * 60_000;
export const FIRMWARE_PUSH_RETRY_COOLDOWN_MS = 6 * 60 * 60_000;
export const FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION = 3;
export const FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT = 50;

const FIRMWARE_PUSH_SAFE_UI_STATE_LIST: readonly string[] = ['idle', 'dashboard'];

const firmwarePushStateSchema = z.object({
  attemptedVersion: z.string().optional(),
  attemptedAtMilliseconds: z.number().optional(),
  attemptCount: z.number().int().min(0),
  lastCheckedAtMilliseconds: z.number(),
});

export type FirmwarePushState = {
  readonly attemptedVersion?: string;
  readonly attemptedAtMilliseconds?: number;
  readonly attemptCount: number;
  readonly lastCheckedAtMilliseconds: number;
};

const firmwareChangelogStateSchema = z.object({
  pendingVersion: z.string().optional(),
  announcedVersion: z.string().optional(),
});

export type FirmwareChangelogState = {
  readonly pendingVersion?: string;
  readonly announcedVersion?: string;
};

// Mirrors the device's Ota::IsNewVersionAvailable exactly: numeric compare per
// dot-segment, and on a tie prefix the longer version wins ("2.6.0" > "2.6").
// Diverging from the firmware here would push an upgrade the device rejects.
export function compareFirmwareVersions(
  leftVersion: string,
  rightVersion: string,
): number {
  const leftSegmentList = leftVersion.split('.').map(Number);
  const rightSegmentList = rightVersion.split('.').map(Number);
  const sharedSegmentCount = Math.min(leftSegmentList.length, rightSegmentList.length);
  for (let segmentIndex = 0; segmentIndex < sharedSegmentCount; segmentIndex += 1) {
    const difference =
      (leftSegmentList[segmentIndex] ?? 0) - (rightSegmentList[segmentIndex] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return leftSegmentList.length - rightSegmentList.length;
}

export function shouldCheckFirmwareManifest(input: {
  readonly pushState: FirmwarePushState | undefined;
  readonly didChargingEdgeOccur: boolean;
  readonly nowMilliseconds: number;
}): boolean {
  if (input.didChargingEdgeOccur || input.pushState === undefined) {
    return true;
  }
  return (
    input.nowMilliseconds - input.pushState.lastCheckedAtMilliseconds >=
    FIRMWARE_PUSH_CHECK_INTERVAL_MS
  );
}

export type FirmwarePushSkipReason =
  | 'no_reported_version'
  | 'already_current'
  | 'attempt_limit'
  | 'retry_cooldown'
  | 'unsafe_ui_state'
  | 'confirm_pending'
  | 'announcement_in_flight'
  | 'focus_active'
  | 'insufficient_power';

export type FirmwarePushEvaluation = {
  readonly shouldPush: boolean;
  readonly reason?: FirmwarePushSkipReason;
};

export function evaluateFirmwarePush(input: {
  readonly snapshot: DeskTelemetrySnapshot;
  readonly manifestVersion: string;
  readonly uiState: string;
  readonly isFocusActive: boolean;
  readonly hasPendingConfirmation: boolean;
  readonly isAnnouncementInFlight: boolean;
  readonly pushState: FirmwarePushState | undefined;
  readonly nowMilliseconds: number;
}): FirmwarePushEvaluation {
  if (input.snapshot.firmwareVersion === undefined) {
    return { shouldPush: false, reason: 'no_reported_version' };
  }
  if (
    compareFirmwareVersions(input.manifestVersion, input.snapshot.firmwareVersion) <= 0
  ) {
    return { shouldPush: false, reason: 'already_current' };
  }
  // A device that accepted the push but reappeared on the old version rolled
  // back or failed to flash — hammering it in a loop wastes its battery and
  // bandwidth, so attempts per manifest version are capped and spaced out.
  if (input.pushState?.attemptedVersion === input.manifestVersion) {
    if (input.pushState.attemptCount >= FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION) {
      return { shouldPush: false, reason: 'attempt_limit' };
    }
    if (
      input.pushState.attemptedAtMilliseconds !== undefined &&
      input.nowMilliseconds - input.pushState.attemptedAtMilliseconds <
        FIRMWARE_PUSH_RETRY_COOLDOWN_MS
    ) {
      return { shouldPush: false, reason: 'retry_cooldown' };
    }
  }
  if (!FIRMWARE_PUSH_SAFE_UI_STATE_LIST.includes(input.uiState)) {
    return { shouldPush: false, reason: 'unsafe_ui_state' };
  }
  if (input.hasPendingConfirmation) {
    return { shouldPush: false, reason: 'confirm_pending' };
  }
  if (input.isAnnouncementInFlight) {
    return { shouldPush: false, reason: 'announcement_in_flight' };
  }
  if (input.isFocusActive) {
    return { shouldPush: false, reason: 'focus_active' };
  }
  const hasEnoughPower =
    input.snapshot.charging === true ||
    (input.snapshot.battery !== undefined &&
      input.snapshot.battery >= FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT);
  if (!hasEnoughPower) {
    return { shouldPush: false, reason: 'insufficient_power' };
  }
  return { shouldPush: true };
}

export function recordFirmwareManifestCheck(
  pushState: FirmwarePushState | undefined,
  nowMilliseconds: number,
): FirmwarePushState {
  return {
    ...pushState,
    attemptCount: pushState?.attemptCount ?? 0,
    lastCheckedAtMilliseconds: nowMilliseconds,
  };
}

export function recordFirmwarePushAttempt(
  pushState: FirmwarePushState | undefined,
  manifestVersion: string,
  nowMilliseconds: number,
): FirmwarePushState {
  const isRetryOfSameVersion = pushState?.attemptedVersion === manifestVersion;
  return {
    attemptedVersion: manifestVersion,
    attemptedAtMilliseconds: nowMilliseconds,
    attemptCount: isRetryOfSameVersion ? pushState.attemptCount + 1 : 1,
    lastCheckedAtMilliseconds: pushState?.lastCheckedAtMilliseconds ?? nowMilliseconds,
  };
}

export function detectFirmwareVersionChange(input: {
  readonly previousFirmwareVersion: string | undefined;
  readonly nextFirmwareVersion: string | undefined;
}): { readonly fromVersion: string; readonly toVersion: string } | undefined {
  if (
    input.previousFirmwareVersion === undefined ||
    input.nextFirmwareVersion === undefined
  ) {
    return undefined;
  }
  // Only a real upgrade edge counts: a rollback reporting the old version
  // must not produce a false "me actualicé".
  if (
    compareFirmwareVersions(input.nextFirmwareVersion, input.previousFirmwareVersion) <= 0
  ) {
    return undefined;
  }
  return {
    fromVersion: input.previousFirmwareVersion,
    toVersion: input.nextFirmwareVersion,
  };
}

export function buildFirmwareChangelogMessage(input: {
  readonly toVersion: string;
  readonly changelogText?: string;
}): string {
  if (input.changelogText === undefined) {
    return `Me actualicé al firmware ${input.toVersion} mientras no me usabas.`;
  }
  const normalizedChangelogText = input.changelogText.trim().replace(/\.+$/, '');
  return `Me actualicé al firmware ${input.toVersion}: ${normalizedChangelogText}.`;
}

export function parseStoredFirmwarePushState(
  storedValue: string,
): FirmwarePushState | undefined {
  try {
    const parsedState = firmwarePushStateSchema.safeParse(JSON.parse(storedValue));
    return parsedState.success ? parsedState.data : undefined;
  } catch {
    return undefined;
  }
}

export function parseStoredFirmwareChangelogState(
  storedValue: string,
): FirmwareChangelogState | undefined {
  try {
    const parsedState = firmwareChangelogStateSchema.safeParse(JSON.parse(storedValue));
    return parsedState.success ? parsedState.data : undefined;
  } catch {
    return undefined;
  }
}
