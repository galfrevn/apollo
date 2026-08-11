import { describe, expect, it } from 'bun:test';

import {
  buildTelemetryPromptNote,
  evaluateLowBatteryAnnouncement,
  LOW_BATTERY_ANNOUNCE_COOLDOWN_MS,
  parseStoredTelemetrySnapshot,
  TELEMETRY_PROMPT_STALENESS_MS,
  type DeskTelemetrySnapshot,
} from '@/telemetry/logic';

const NOW_MILLISECONDS = 1_754_830_000_000;

function createSnapshot(
  overrides: Partial<DeskTelemetrySnapshot> = {},
): DeskTelemetrySnapshot {
  return {
    battery: 87,
    charging: false,
    volume: 70,
    wifiRssi: -52,
    firmwareVersion: '2.4.2',
    receivedAtMs: NOW_MILLISECONDS,
    ...overrides,
  };
}

describe('parseStoredTelemetrySnapshot', () => {
  it('restores a stored snapshot', () => {
    const snapshot = createSnapshot();
    expect(parseStoredTelemetrySnapshot(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it('rejects malformed json', () => {
    expect(parseStoredTelemetrySnapshot('{"battery":')).toBeUndefined();
  });

  it('rejects json that is not an object', () => {
    expect(parseStoredTelemetrySnapshot('null')).toBeUndefined();
    expect(parseStoredTelemetrySnapshot('"87%"')).toBeUndefined();
  });

  it('rejects a snapshot without a usable timestamp', () => {
    expect(parseStoredTelemetrySnapshot('{"battery":87}')).toBeUndefined();
    expect(
      parseStoredTelemetrySnapshot('{"battery":87,"receivedAtMs":"reciente"}'),
    ).toBeUndefined();
  });

  it('rejects a snapshot whose fields have the wrong type', () => {
    expect(
      parseStoredTelemetrySnapshot(`{"battery":"87","receivedAtMs":${NOW_MILLISECONDS}}`),
    ).toBeUndefined();
  });
});

describe('buildTelemetryPromptNote', () => {
  it('describes every field of a fresh snapshot', () => {
    const note = buildTelemetryPromptNote(createSnapshot(), NOW_MILLISECONDS);
    expect(note).toBe(
      '\n\nEstado del dispositivo: batería 87% (con batería), volumen 70, WiFi -52 dBm, firmware 2.4.2.',
    );
  });

  it('labels a charging battery', () => {
    const note = buildTelemetryPromptNote(
      createSnapshot({ charging: true }),
      NOW_MILLISECONDS,
    );
    expect(note).toContain('batería 87% (cargando)');
  });

  it('omits absent fields', () => {
    const note = buildTelemetryPromptNote(
      {
        volume: 55,
        receivedAtMs: NOW_MILLISECONDS,
      },
      NOW_MILLISECONDS,
    );
    expect(note).toBe('\n\nEstado del dispositivo: volumen 55.');
  });

  it('returns empty for an undefined snapshot', () => {
    expect(buildTelemetryPromptNote(undefined, NOW_MILLISECONDS)).toBe('');
  });

  it('returns empty for a stale snapshot', () => {
    const note = buildTelemetryPromptNote(
      createSnapshot({
        receivedAtMs: NOW_MILLISECONDS - TELEMETRY_PROMPT_STALENESS_MS - 1,
      }),
      NOW_MILLISECONDS,
    );
    expect(note).toBe('');
  });

  it('returns empty for a snapshot with no reportable fields', () => {
    expect(
      buildTelemetryPromptNote({ receivedAtMs: NOW_MILLISECONDS }, NOW_MILLISECONDS),
    ).toBe('');
  });
});

describe('evaluateLowBatteryAnnouncement', () => {
  it('announces at the threshold while discharging', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 12, charging: false }),
      lastAnnounceAtMilliseconds: null,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(true);
    expect(evaluation.message).toBe('Estás con 12% de batería, enchufame.');
  });

  it('stays quiet while charging', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 12, charging: true }),
      lastAnnounceAtMilliseconds: null,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(false);
  });

  it('stays quiet above the threshold', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 16, charging: false }),
      lastAnnounceAtMilliseconds: null,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(false);
    expect(evaluation.shouldRearm).toBe(false);
  });

  it('stays quiet without a battery reading', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: { receivedAtMs: NOW_MILLISECONDS },
      lastAnnounceAtMilliseconds: null,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(false);
  });

  it('respects the cooldown after an announcement', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 10, charging: false }),
      lastAnnounceAtMilliseconds: NOW_MILLISECONDS - LOW_BATTERY_ANNOUNCE_COOLDOWN_MS + 1,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(false);
  });

  it('announces again once the cooldown expires', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 10, charging: false }),
      lastAnnounceAtMilliseconds: NOW_MILLISECONDS - LOW_BATTERY_ANNOUNCE_COOLDOWN_MS,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldAnnounce).toBe(true);
  });

  it('re-arms when charging is observed', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 12, charging: true }),
      lastAnnounceAtMilliseconds: NOW_MILLISECONDS - 60_000,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldRearm).toBe(true);
  });

  it('re-arms when the battery recovers past the hysteresis band', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 25, charging: false }),
      lastAnnounceAtMilliseconds: NOW_MILLISECONDS - 60_000,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldRearm).toBe(true);
  });

  it('does not re-arm when there is nothing to clear', () => {
    const evaluation = evaluateLowBatteryAnnouncement({
      snapshot: createSnapshot({ battery: 90, charging: true }),
      lastAnnounceAtMilliseconds: null,
      nowMilliseconds: NOW_MILLISECONDS,
    });
    expect(evaluation.shouldRearm).toBe(false);
  });
});
