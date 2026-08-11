import { z } from 'zod';

export const deskUiStateSchema = z.enum([
  'idle',
  'listening',
  'thinking',
  'confirm',
  'speaking',
  'focus',
  'dashboard',
]);

export type DeskUiStateName = z.infer<typeof deskUiStateSchema>;

export const deskFaceEmotionSchema = z.enum([
  'neutral',
  'curious',
  'focused',
  'questioning',
  'talking',
  'calm',
]);

export type DeskFaceEmotionName = z.infer<typeof deskFaceEmotionSchema>;

export const deviceGestureSchema = z.enum([
  'tap',
  'double_tap',
  'swipe_left',
  'swipe_right',
]);

export const deskSoundEffectSchema = z.enum(['ding', 'chime', 'error', 'low_battery']);

export type DeskSoundEffectName = z.infer<typeof deskSoundEffectSchema>;

export const confirmCloseReasonSchema = z.enum(['resolved', 'expired', 'orphaned']);

export type ConfirmCloseReasonName = z.infer<typeof confirmCloseReasonSchema>;

export const deviceToServerMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('hello'),
    deviceId: z.string().min(1),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('hold_start'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('hold_end'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('wake'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('audio_end'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('listen_cancel'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('gesture'),
    gesture: deviceGestureSchema,
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('confirm'),
    ok: z.boolean(),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('text_input'),
    text: z.string().min(1),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('abort'),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('telemetry'),
    battery: z.number().int().nonnegative().max(100).optional(),
    charging: z.boolean().optional(),
    volume: z.number().int().nonnegative().optional(),
    wifiRssi: z.number().int().optional(),
    firmwareVersion: z.string().min(1).optional(),
    ts: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('mcp'),
    payload: z.object({
      jsonrpc: z.literal('2.0'),
      id: z.number().int(),
      result: z.unknown().optional(),
      error: z
        .object({
          code: z.number().int().optional(),
          message: z.string().min(1),
        })
        .optional(),
    }),
    ts: z.number().int().nonnegative(),
  }),
]);

export type DeviceToServerMessage = z.infer<typeof deviceToServerMessageSchema>;

export const serverToDeviceMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('ui_state'),
    state: deskUiStateSchema,
    speechMode: z.string().min(1),
    caption: z.string().optional(),
    focusRemainingSec: z.number().int().nonnegative().optional(),
    emotion: deskFaceEmotionSchema.optional(),
    accentColor: z.string().optional(),
  }),
  z.object({
    type: z.literal('confirm_request'),
    id: z.string().min(1),
    summary: z.string().min(1),
    expiresAt: z.number().int().nonnegative(),
  }),
  z.object({
    type: z.literal('confirm_close'),
    id: z.string().min(1),
    reason: confirmCloseReasonSchema,
  }),
  z.object({
    type: z.literal('tts_start'),
    format: z.enum(['mp3', 'wav', 'pcm']),
    bytes: z.number().int().nonnegative(),
    sampleRate: z.number().int().positive().optional(),
    channels: z.number().int().positive().optional(),
  }),
  z.object({
    type: z.literal('tts_aborted'),
  }),
  z.object({
    type: z.literal('turn_end'),
    expectsReply: z.boolean(),
  }),
  z.object({
    type: z.literal('error'),
    code: z.string().min(1),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal('dashboard'),
    clock: z.object({
      timezone: z.string().min(1),
      isoNow: z.string().min(1),
    }),
    weather: z.object({
      locationLabel: z.string().min(1),
      temperatureC: z.number(),
      conditionLabel: z.string().min(1),
      updatedAt: z.string().min(1),
    }),
  }),
  z.object({
    type: z.literal('background_result'),
    summary: z.string().min(1),
    prompt: z.string().min(1),
    documentKey: z.string().min(1).optional(),
  }),
  z.object({
    type: z.literal('reminder'),
    message: z.string().min(1),
  }),
  z.object({
    type: z.literal('play_effect'),
    name: deskSoundEffectSchema,
  }),
  z.object({
    type: z.literal('mcp'),
    payload: z.object({
      jsonrpc: z.literal('2.0'),
      // The device's McpServer silently drops string ids, so the integer
      // constraint here is what keeps every request answerable.
      id: z.number().int(),
      method: z.string().min(1),
      params: z.record(z.unknown()).optional(),
    }),
  }),
]);

export type ServerToDeviceMessage = z.infer<typeof serverToDeviceMessageSchema>;

export function parseDeviceToServerMessage(rawPayload: unknown): DeviceToServerMessage {
  if (typeof rawPayload === 'string') {
    return deviceToServerMessageSchema.parse(JSON.parse(rawPayload));
  }
  return deviceToServerMessageSchema.parse(rawPayload);
}

export function encodeServerToDeviceMessage(message: ServerToDeviceMessage): string {
  return JSON.stringify(serverToDeviceMessageSchema.parse(message));
}
