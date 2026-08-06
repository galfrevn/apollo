import { describe, expect, it } from 'bun:test';

import {
  encodeServerToDeviceMessage,
  parseDeviceToServerMessage,
} from '@/protocol/schema';

describe('protocol schema', () => {
  it('parses hold_start', () => {
    const message = parseDeviceToServerMessage(
      JSON.stringify({ type: 'hold_start', ts: 1 }),
    );
    expect(message).toEqual({ type: 'hold_start', ts: 1 });
  });

  it('parses audio_end', () => {
    const message = parseDeviceToServerMessage({ type: 'audio_end', ts: 2 });
    expect(message.type).toBe('audio_end');
  });

  it('rejects unknown type', () => {
    expect(() => parseDeviceToServerMessage(JSON.stringify({ type: 'nope' }))).toThrow();
  });

  it('encodes ui_state', () => {
    const raw = encodeServerToDeviceMessage({
      type: 'ui_state',
      state: 'listening',
      speechMode: 'default',
    });
    expect(JSON.parse(raw)).toMatchObject({
      type: 'ui_state',
      state: 'listening',
      speechMode: 'default',
    });
  });

  it('encodes dashboard with clock and weather', () => {
    const raw = encodeServerToDeviceMessage({
      type: 'dashboard',
      clock: {
        timezone: 'America/Argentina/Buenos_Aires',
        isoNow: '2026-08-05T17:00:00.000Z',
      },
      weather: {
        locationLabel: 'Buenos Aires',
        temperatureC: 18,
        conditionLabel: 'Parcialmente nublado',
        updatedAt: '2026-08-05T17:00:00.000Z',
      },
    });
    expect(JSON.parse(raw)).toMatchObject({
      type: 'dashboard',
      clock: { timezone: 'America/Argentina/Buenos_Aires' },
      weather: { temperatureC: 18, locationLabel: 'Buenos Aires' },
    });
  });

  it('encodes background_result and reminder', () => {
    expect(
      JSON.parse(
        encodeServerToDeviceMessage({
          type: 'background_result',
          summary: 'Listo',
          prompt: 'investigá X',
        }),
      ),
    ).toMatchObject({ type: 'background_result', summary: 'Listo' });
    expect(
      JSON.parse(
        encodeServerToDeviceMessage({
          type: 'background_result',
          summary: 'Listo',
          prompt: 'investigá X',
          documentKey: 'research/abc123',
        }),
      ),
    ).toMatchObject({
      type: 'background_result',
      summary: 'Listo',
      documentKey: 'research/abc123',
    });
    expect(
      JSON.parse(
        encodeServerToDeviceMessage({
          type: 'reminder',
          message: 'Tomá agua',
        }),
      ),
    ).toMatchObject({ type: 'reminder', message: 'Tomá agua' });
  });
});
