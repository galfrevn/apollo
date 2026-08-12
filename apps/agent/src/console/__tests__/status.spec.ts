import { describe, expect, it } from 'bun:test';

import { buildConsoleStatusSnapshot } from '@/console/status';

describe('console status', () => {
  it('reports a connected device and passes telemetry through', () => {
    const snapshot = buildConsoleStatusSnapshot({
      deviceConnectionCount: 2,
      telemetrySnapshot: { battery: 80, charging: true, receivedAtMs: 1_000 },
      pendingReminderCount: 3,
      nowMilliseconds: 5_000,
    });

    expect(snapshot.isDeviceConnected).toBe(true);
    expect(snapshot.deviceConnectionCount).toBe(2);
    expect(snapshot.telemetry).toEqual({
      battery: 80,
      charging: true,
      receivedAtMs: 1_000,
    });
    expect(snapshot.pendingReminderCount).toBe(3);
    expect(snapshot.nowMilliseconds).toBe(5_000);
  });

  it('reports a disconnected device and null telemetry when nothing is stored', () => {
    const snapshot = buildConsoleStatusSnapshot({
      deviceConnectionCount: 0,
      telemetrySnapshot: undefined,
      pendingReminderCount: 0,
      nowMilliseconds: 5_000,
    });

    expect(snapshot.isDeviceConnected).toBe(false);
    expect(snapshot.telemetry).toBeNull();
  });
});
