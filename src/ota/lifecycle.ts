import {
  buildInitiativeDeliveryMarkerKey,
  type InitiativeDeliveryOutcome,
  type InitiativeSource,
  type InitiativeUtteranceInput,
} from '@/initiative/logic';
import {
  getSessionPreference,
  setSessionPreference,
  type MemorySqlExecutor,
} from '@/memory/store';
import { readFirmwareManifest } from '@/ota/manifest';
import {
  buildFirmwareChangelogMessage,
  detectFirmwareVersionChange,
  evaluateFirmwarePush,
  parseStoredFirmwareChangelogState,
  parseStoredFirmwarePushState,
  recordFirmwareManifestCheck,
  recordFirmwarePushAttempt,
  shouldCheckFirmwareManifest,
} from '@/ota/push';
import type { DeskTelemetrySnapshot } from '@/telemetry/logic';
import type { ToolExecutionResult } from '@/tools/types';

export const FIRMWARE_PUSH_STATE_PREFERENCE_KEY = 'firmwarePushState';
export const FIRMWARE_CHANGELOG_STATE_PREFERENCE_KEY = 'firmwareChangelogState';
export const PUBLIC_ORIGIN_PREFERENCE_KEY = 'publicOrigin';

export type FirmwareLifecycleDependencies = {
  readonly sqlExecutor: MemorySqlExecutor;
  readonly mediaBucket: R2Bucket;
  readonly deviceSharedSecret: string;
  readonly isPushDisabled: boolean;
  readonly uiState: string;
  readonly isFocusActive: boolean;
  readonly hasPendingConfirmation: boolean;
  readonly isAnnouncementInFlight: boolean;
  readonly nowMilliseconds: number;
  readonly deliverInitiativeUtterance: (
    utterance: InitiativeUtteranceInput,
  ) => Promise<InitiativeDeliveryOutcome>;
  readonly hasScheduledInitiativeRetry: (source: InitiativeSource) => Promise<boolean>;
  readonly callDeviceTool: (
    deviceToolName: string,
    argumentRecord: Record<string, unknown>,
  ) => Promise<ToolExecutionResult>;
};

// Roadmap item 23: after a reboot the first telemetry reports the new version
// (the changelog edge), and every telemetry tick is a chance to push a pending
// update when the device is idle and powered.
export async function runFirmwareLifecycle(
  input: {
    readonly previousFirmwareVersion: string | undefined;
    readonly snapshot: DeskTelemetrySnapshot;
    readonly didChargingEdgeOccur: boolean;
  },
  dependencies: FirmwareLifecycleDependencies,
): Promise<void> {
  const { sqlExecutor, nowMilliseconds } = dependencies;

  const storedChangelogState = await getSessionPreference(
    sqlExecutor,
    FIRMWARE_CHANGELOG_STATE_PREFERENCE_KEY,
  );
  let changelogState =
    storedChangelogState === null
      ? undefined
      : parseStoredFirmwareChangelogState(storedChangelogState);

  const versionChange = detectFirmwareVersionChange({
    previousFirmwareVersion: input.previousFirmwareVersion,
    nextFirmwareVersion: input.snapshot.firmwareVersion,
  });
  if (versionChange !== undefined) {
    changelogState = { ...changelogState, pendingVersion: versionChange.toVersion };
    await setSessionPreference(
      sqlExecutor,
      FIRMWARE_CHANGELOG_STATE_PREFERENCE_KEY,
      JSON.stringify(changelogState),
    );
    // The device came back on the new version: the attempt marker did its job
    // and must not throttle the next release.
    await setSessionPreference(
      sqlExecutor,
      FIRMWARE_PUSH_STATE_PREFERENCE_KEY,
      JSON.stringify(recordFirmwareManifestCheck(undefined, nowMilliseconds)),
    );
    console.log(
      JSON.stringify({
        level: 'info',
        message: 'firmware_changelog_pending',
        fromVersion: versionChange.fromVersion,
        toVersion: versionChange.toVersion,
      }),
    );
  }

  if (
    changelogState?.pendingVersion !== undefined &&
    changelogState.pendingVersion !== changelogState.announcedVersion
  ) {
    const pendingVersion = changelogState.pendingVersion;
    // The version is only marked announced once it was actually spoken: the
    // delivery marker survives a deferred retry chain, the in-flight check
    // prevents duplicate scheduling while one is pending, and if the whole
    // retry chain dies suppressed, the still-pending version re-queues here
    // on a later telemetry tick — the changelog can be late, never lost.
    const deliveryMarkerKey = buildInitiativeDeliveryMarkerKey(
      `firmware-changelog-${pendingVersion}`,
    );
    const deliveredAt = await getSessionPreference(sqlExecutor, deliveryMarkerKey);
    if (deliveredAt !== null) {
      changelogState = { announcedVersion: pendingVersion };
      await setSessionPreference(
        sqlExecutor,
        FIRMWARE_CHANGELOG_STATE_PREFERENCE_KEY,
        JSON.stringify(changelogState),
      );
    } else if (!(await dependencies.hasScheduledInitiativeRetry('firmware_changelog'))) {
      const manifest = await readFirmwareManifest(dependencies.mediaBucket);
      const changelogText =
        manifest !== undefined && manifest.version === pendingVersion
          ? manifest.changelog
          : undefined;
      const deliveryOutcome = await dependencies.deliverInitiativeUtterance({
        source: 'firmware_changelog',
        priority: 'normal',
        message: buildFirmwareChangelogMessage({
          toVersion: pendingVersion,
          ...(changelogText !== undefined ? { changelogText } : {}),
        }),
        earconName: 'chime',
        utteranceKey: `firmware-changelog-${pendingVersion}`,
      });
      if (deliveryOutcome === 'delivered') {
        changelogState = { announcedVersion: pendingVersion };
        await setSessionPreference(
          sqlExecutor,
          FIRMWARE_CHANGELOG_STATE_PREFERENCE_KEY,
          JSON.stringify(changelogState),
        );
      }
    }
  }

  if (dependencies.isPushDisabled) {
    return;
  }
  const storedPushState = await getSessionPreference(
    sqlExecutor,
    FIRMWARE_PUSH_STATE_PREFERENCE_KEY,
  );
  const pushState =
    storedPushState === null ? undefined : parseStoredFirmwarePushState(storedPushState);
  if (
    !shouldCheckFirmwareManifest({
      pushState,
      didChargingEdgeOccur: input.didChargingEdgeOccur,
      nowMilliseconds,
    })
  ) {
    return;
  }
  const manifest = await readFirmwareManifest(dependencies.mediaBucket);
  const checkedPushState = recordFirmwareManifestCheck(pushState, nowMilliseconds);
  await setSessionPreference(
    sqlExecutor,
    FIRMWARE_PUSH_STATE_PREFERENCE_KEY,
    JSON.stringify(checkedPushState),
  );
  if (manifest === undefined) {
    return;
  }
  const evaluation = evaluateFirmwarePush({
    snapshot: input.snapshot,
    manifestVersion: manifest.version,
    uiState: dependencies.uiState,
    isFocusActive: dependencies.isFocusActive,
    hasPendingConfirmation: dependencies.hasPendingConfirmation,
    isAnnouncementInFlight: dependencies.isAnnouncementInFlight,
    pushState: checkedPushState,
    nowMilliseconds,
  });
  if (!evaluation.shouldPush) {
    if (evaluation.reason !== 'already_current') {
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'firmware_push_skipped',
          reason: evaluation.reason,
        }),
      );
    }
    return;
  }
  const publicOrigin = await getSessionPreference(
    sqlExecutor,
    PUBLIC_ORIGIN_PREFERENCE_KEY,
  );
  if (publicOrigin === null) {
    console.error(
      JSON.stringify({ level: 'error', message: 'firmware_push_missing_origin' }),
    );
    return;
  }
  const firmwareBinaryUrl = new URL('/ota/firmware.bin', publicOrigin);
  firmwareBinaryUrl.searchParams.set('token', dependencies.deviceSharedSecret);
  // Recorded before the call: a crash mid-push must read as an attempt, or the
  // device could be flashed in a loop.
  await setSessionPreference(
    sqlExecutor,
    FIRMWARE_PUSH_STATE_PREFERENCE_KEY,
    JSON.stringify(
      recordFirmwarePushAttempt(checkedPushState, manifest.version, nowMilliseconds),
    ),
  );
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'firmware_push_attempted',
      manifestVersion: manifest.version,
      deviceVersion: input.snapshot.firmwareVersion,
    }),
  );
  const pushResult = await dependencies.callDeviceTool('self.upgrade_firmware', {
    url: firmwareBinaryUrl.toString(),
  });
  console.log(
    JSON.stringify({
      level: 'info',
      message: 'firmware_push_result',
      ok: pushResult.ok,
      summary: pushResult.summary,
    }),
  );
}
