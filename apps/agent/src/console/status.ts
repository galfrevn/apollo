import type { DeskTelemetrySnapshot } from '@/telemetry/logic';

export type ConsoleStatusSnapshot = {
  readonly isDeviceConnected: boolean;
  readonly deviceConnectionCount: number;
  readonly telemetry: DeskTelemetrySnapshot | null;
  readonly pendingReminderCount: number;
  readonly nowMilliseconds: number;
};

export function buildConsoleStatusSnapshot(input: {
  readonly deviceConnectionCount: number;
  readonly telemetrySnapshot: DeskTelemetrySnapshot | undefined;
  readonly pendingReminderCount: number;
  readonly nowMilliseconds: number;
}): ConsoleStatusSnapshot {
  return {
    isDeviceConnected: input.deviceConnectionCount > 0,
    deviceConnectionCount: input.deviceConnectionCount,
    telemetry: input.telemetrySnapshot ?? null,
    pendingReminderCount: input.pendingReminderCount,
    nowMilliseconds: input.nowMilliseconds,
  };
}
