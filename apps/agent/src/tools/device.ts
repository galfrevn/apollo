import { z } from 'zod';

import type { ToolDefinition, ToolExecutionResult } from '@/tools/types';

export const DEVICE_VOLUME_TOOL_NAME = 'self.audio_speaker.set_volume';
export const DEVICE_BRIGHTNESS_TOOL_NAME = 'self.screen.set_brightness';
export const DEVICE_STATUS_TOOL_NAME = 'self.get_device_status';

const setVolumeArgsSchema = z.object({
  volume: z.number().int().min(0).max(100),
});

const setBrightnessArgsSchema = z.object({
  brightness: z.number().int().min(0).max(100),
});

export const setVolumeTool: ToolDefinition = {
  name: 'set_volume',
  safety: 'safe',
  description: 'Cambia el volumen del parlante del dispositivo (0 a 100)',
  parameters: {
    type: 'object',
    properties: {
      volume: { type: 'number', minimum: 0, maximum: 100 },
    },
    required: ['volume'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = setVolumeArgsSchema.parse(args);
    const deviceResult = await context.effects.callDeviceTool({
      deviceToolName: DEVICE_VOLUME_TOOL_NAME,
      argumentRecord: { volume: parsedArgs.volume },
    });
    if (!deviceResult.ok) {
      return deviceResult;
    }
    return { ok: true, summary: `Volumen al ${parsedArgs.volume}%.` };
  },
};

export const setBrightnessTool: ToolDefinition = {
  name: 'set_brightness',
  safety: 'safe',
  description: 'Cambia el brillo de la pantalla del dispositivo (0 a 100)',
  parameters: {
    type: 'object',
    properties: {
      brightness: { type: 'number', minimum: 0, maximum: 100 },
    },
    required: ['brightness'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = setBrightnessArgsSchema.parse(args);
    const deviceResult = await context.effects.callDeviceTool({
      deviceToolName: DEVICE_BRIGHTNESS_TOOL_NAME,
      argumentRecord: { brightness: parsedArgs.brightness },
    });
    if (!deviceResult.ok) {
      return deviceResult;
    }
    return { ok: true, summary: `Brillo al ${parsedArgs.brightness}%.` };
  },
};

function parseDeviceStatusSummary(
  deviceResult: ToolExecutionResult,
): ToolExecutionResult {
  try {
    const parsedStatusData: unknown = JSON.parse(deviceResult.summary);
    return {
      ok: true,
      summary: 'Estado del dispositivo obtenido.',
      data: parsedStatusData,
    };
  } catch {
    return deviceResult;
  }
}

export const deviceStatusTool: ToolDefinition = {
  name: 'device_status',
  safety: 'safe',
  description: 'Lee el estado actual del dispositivo: volumen, brillo, batería y red',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const deviceResult = await context.effects.callDeviceTool({
      deviceToolName: DEVICE_STATUS_TOOL_NAME,
      argumentRecord: {},
    });
    if (!deviceResult.ok) {
      return deviceResult;
    }
    return parseDeviceStatusSummary(deviceResult);
  },
};
