import { describe, expect, it } from 'bun:test';

import {
  encodeServerToDeviceMessage,
  parseDeviceToServerMessage,
} from '@/protocol/schema';

describe('protocol schema', () => {
  it('parses hello with and without a declared protocol version', () => {
    expect(
      parseDeviceToServerMessage({ type: 'hello', deviceId: 'desk-01', ts: 1 }),
    ).toEqual({ type: 'hello', deviceId: 'desk-01', ts: 1 });
    expect(
      parseDeviceToServerMessage({
        type: 'hello',
        deviceId: 'desk-01',
        protocol: '1.0',
        ts: 1,
      }),
    ).toEqual({ type: 'hello', deviceId: 'desk-01', protocol: '1.0', ts: 1 });
  });

  it('rejects hello with an empty protocol version', () => {
    expect(() =>
      parseDeviceToServerMessage({
        type: 'hello',
        deviceId: 'desk-01',
        protocol: '',
        ts: 1,
      }),
    ).toThrow();
  });

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

  it('parses telemetry with every field', () => {
    const message = parseDeviceToServerMessage({
      type: 'telemetry',
      battery: 87,
      charging: false,
      volume: 70,
      wifiRssi: -52,
      firmwareVersion: '2.4.2',
      ts: 3,
    });
    expect(message).toEqual({
      type: 'telemetry',
      battery: 87,
      charging: false,
      volume: 70,
      wifiRssi: -52,
      firmwareVersion: '2.4.2',
      ts: 3,
    });
  });

  it('parses telemetry with only type and ts', () => {
    const message = parseDeviceToServerMessage({ type: 'telemetry', ts: 4 });
    expect(message).toEqual({ type: 'telemetry', ts: 4 });
  });

  it('rejects telemetry with battery out of range', () => {
    expect(() =>
      parseDeviceToServerMessage({ type: 'telemetry', battery: -1, ts: 5 }),
    ).toThrow();
    expect(() =>
      parseDeviceToServerMessage({ type: 'telemetry', battery: 101, ts: 5 }),
    ).toThrow();
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

  it('encodes ui_state with face emotion and accent color', () => {
    const raw = encodeServerToDeviceMessage({
      type: 'ui_state',
      state: 'speaking',
      speechMode: 'warm',
      emotion: 'talking',
      accentColor: '#B56B7A',
    });
    expect(JSON.parse(raw)).toMatchObject({
      type: 'ui_state',
      emotion: 'talking',
      accentColor: '#B56B7A',
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

  it('encodes confirm_close for every reason', () => {
    for (const reason of ['resolved', 'expired', 'orphaned'] as const) {
      expect(
        JSON.parse(
          encodeServerToDeviceMessage({ type: 'confirm_close', id: 'c1', reason }),
        ),
      ).toEqual({ type: 'confirm_close', id: 'c1', reason });
    }
  });

  it('rejects confirm_close with an empty id or unknown reason', () => {
    expect(() =>
      encodeServerToDeviceMessage({
        type: 'confirm_close',
        id: '',
        reason: 'expired',
      }),
    ).toThrow();
    expect(() =>
      encodeServerToDeviceMessage({
        type: 'confirm_close',
        id: 'c1',
        reason: 'nope' as never,
      }),
    ).toThrow();
  });

  it('encodes play_effect for every catalog name', () => {
    for (const effectName of ['ding', 'chime', 'error', 'low_battery'] as const) {
      expect(
        JSON.parse(
          encodeServerToDeviceMessage({ type: 'play_effect', name: effectName }),
        ),
      ).toEqual({ type: 'play_effect', name: effectName });
    }
  });

  it('rejects play_effect with an unknown name', () => {
    expect(() =>
      encodeServerToDeviceMessage({
        type: 'play_effect',
        name: 'nope' as never,
      }),
    ).toThrow();
  });

  it('parses mcp responses with result or error', () => {
    expect(
      parseDeviceToServerMessage({
        type: 'mcp',
        payload: {
          jsonrpc: '2.0',
          id: 3,
          result: { content: [{ type: 'text', text: 'true' }], isError: false },
        },
        ts: 6,
      }).type,
    ).toBe('mcp');
    expect(
      parseDeviceToServerMessage({
        type: 'mcp',
        payload: { jsonrpc: '2.0', id: 4, error: { message: 'Unknown tool' } },
        ts: 7,
      }).type,
    ).toBe('mcp');
  });

  it('rejects mcp responses without an integer id or without ts', () => {
    expect(() =>
      parseDeviceToServerMessage({
        type: 'mcp',
        payload: { jsonrpc: '2.0', id: 'abc', result: {} },
        ts: 8,
      }),
    ).toThrow();
    expect(() =>
      parseDeviceToServerMessage({
        type: 'mcp',
        payload: { jsonrpc: '2.0', id: 5, result: {} },
      }),
    ).toThrow();
  });

  it('encodes mcp tool calls', () => {
    expect(
      JSON.parse(
        encodeServerToDeviceMessage({
          type: 'mcp',
          payload: {
            jsonrpc: '2.0',
            id: 9,
            method: 'tools/call',
            params: { name: 'self.audio_speaker.set_volume', arguments: { volume: 40 } },
          },
        }),
      ),
    ).toEqual({
      type: 'mcp',
      payload: {
        jsonrpc: '2.0',
        id: 9,
        method: 'tools/call',
        params: { name: 'self.audio_speaker.set_volume', arguments: { volume: 40 } },
      },
    });
  });

  it('rejects outbound mcp calls with a string id', () => {
    expect(() =>
      encodeServerToDeviceMessage({
        type: 'mcp',
        payload: {
          jsonrpc: '2.0',
          id: '9' as never,
          method: 'tools/call',
        },
      }),
    ).toThrow();
  });
});
