import { describe, expect, it } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import {
  DEVICE_BRIGHTNESS_TOOL_NAME,
  DEVICE_STATUS_TOOL_NAME,
  DEVICE_VOLUME_TOOL_NAME,
  deviceStatusTool,
  setBrightnessTool,
  setVolumeTool,
} from '@/tools/device';
import type { DeskToolEffects, ToolExecutionContext } from '@/tools/types';

type DeviceToolCallInput = Parameters<DeskToolEffects['callDeviceTool']>[0];

function createContextWithDeviceCallRecorder(
  deviceResponse = { ok: true, summary: 'true' },
) {
  const callList: DeviceToolCallInput[] = [];
  const context: ToolExecutionContext = {
    environment: createFakeApolloEnvironment(),
    nowMilliseconds: 0,
    effects: createStubDeskToolEffects({
      callDeviceTool: async (input) => {
        callList.push(input);
        return deviceResponse;
      },
    }),
  };
  return { context, readCallList: (): readonly DeviceToolCallInput[] => callList };
}

describe('set_volume', () => {
  it('calls the firmware volume tool and answers in percent', async () => {
    const { context, readCallList } = createContextWithDeviceCallRecorder();
    const result = await setVolumeTool.handler({ volume: 40 }, context);
    expect(result).toEqual({ ok: true, summary: 'Volumen al 40%.' });
    expect(readCallList()).toEqual([
      { deviceToolName: DEVICE_VOLUME_TOOL_NAME, argumentRecord: { volume: 40 } },
    ]);
  });

  it('rejects out-of-range volumes before touching the device', async () => {
    const { context, readCallList } = createContextWithDeviceCallRecorder();
    await expect(setVolumeTool.handler({ volume: 140 }, context)).rejects.toThrow();
    expect(readCallList()).toHaveLength(0);
  });

  it('passes device failures through', async () => {
    const { context } = createContextWithDeviceCallRecorder({
      ok: false,
      summary: 'El dispositivo no está conectado.',
    });
    await expect(setVolumeTool.handler({ volume: 10 }, context)).resolves.toEqual({
      ok: false,
      summary: 'El dispositivo no está conectado.',
    });
  });

  it('fails without effects', async () => {
    const result = await setVolumeTool.handler(
      { volume: 10 },
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 0 },
    );
    expect(result.ok).toBe(false);
  });
});

describe('set_brightness', () => {
  it('calls the firmware brightness tool', async () => {
    const { context, readCallList } = createContextWithDeviceCallRecorder();
    const result = await setBrightnessTool.handler({ brightness: 20 }, context);
    expect(result).toEqual({ ok: true, summary: 'Brillo al 20%.' });
    expect(readCallList()).toEqual([
      { deviceToolName: DEVICE_BRIGHTNESS_TOOL_NAME, argumentRecord: { brightness: 20 } },
    ]);
  });
});

describe('device_status', () => {
  it('parses the status JSON into data', async () => {
    const { context, readCallList } = createContextWithDeviceCallRecorder({
      ok: true,
      summary: '{"audio_speaker":{"volume":70},"battery":{"level":81}}',
    });
    const result = await deviceStatusTool.handler({}, context);
    expect(result.ok).toBe(true);
    expect(result.data).toEqual({
      audio_speaker: { volume: 70 },
      battery: { level: 81 },
    });
    expect(readCallList()).toEqual([
      { deviceToolName: DEVICE_STATUS_TOOL_NAME, argumentRecord: {} },
    ]);
  });

  it('keeps the raw summary when the status is not JSON', async () => {
    const { context } = createContextWithDeviceCallRecorder({
      ok: true,
      summary: 'not json',
    });
    await expect(deviceStatusTool.handler({}, context)).resolves.toEqual({
      ok: true,
      summary: 'not json',
    });
  });
});
