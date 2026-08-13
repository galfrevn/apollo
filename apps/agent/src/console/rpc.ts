import { z } from 'zod';

import {
  BROADCAST_MAX_AUDIO_BYTES,
  BROADCAST_UPLOAD_CHUNK_MAX_BASE64_LENGTH,
  BROADCAST_UPLOAD_MAX_CHUNK_COUNT,
} from '@/broadcast/logic';

export const consoleSecretInputSchema = z.object({
  secret: z.string().min(1),
});

export const consoleBroadcastTextInputSchema = consoleSecretInputSchema.extend({
  message: z.string().min(1).max(500),
});

export const consoleBroadcastUploadBeginInputSchema = consoleSecretInputSchema.extend({
  totalBytes: z.number().int().positive().max(BROADCAST_MAX_AUDIO_BYTES),
  chunkCount: z.number().int().min(1).max(BROADCAST_UPLOAD_MAX_CHUNK_COUNT),
});

export const consoleBroadcastUploadChunkInputSchema = consoleSecretInputSchema.extend({
  uploadId: z.string().min(1),
  chunkIndex: z
    .number()
    .int()
    .min(0)
    .max(BROADCAST_UPLOAD_MAX_CHUNK_COUNT - 1),
  base64Chunk: z.string().min(1).max(BROADCAST_UPLOAD_CHUNK_MAX_BASE64_LENGTH),
});

export const consoleBroadcastUploadCommitInputSchema = consoleSecretInputSchema.extend({
  uploadId: z.string().min(1),
});

export const consoleMemoryBrowseInputSchema = consoleSecretInputSchema.extend({
  query: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const consoleCancelReminderInputSchema = consoleSecretInputSchema.extend({
  reminderId: z.string().min(1),
});

export const consoleCreateReminderInputSchema = consoleSecretInputSchema.extend({
  message: z.string().min(1).max(200),
  delaySeconds: z.number().int().min(5).max(86_400),
  isTimer: z.boolean().optional(),
});

export const consoleDeviceVolumeInputSchema = consoleSecretInputSchema.extend({
  volume: z.number().int().min(0).max(100),
});

export const consoleDeviceBrightnessInputSchema = consoleSecretInputSchema.extend({
  brightness: z.number().int().min(0).max(100),
});

export const consoleSpeechModeInputSchema = consoleSecretInputSchema.extend({
  speechModeId: z.string().min(1).max(30),
});

export const consoleAddMemoryInputSchema = consoleSecretInputSchema.extend({
  content: z.string().min(1).max(500),
});

export const consoleDeleteMemoryInputSchema = consoleSecretInputSchema.extend({
  memoryId: z.string().min(1),
});

export const consoleAddListItemInputSchema = consoleSecretInputSchema.extend({
  listName: z.string().min(1).max(60),
  content: z.string().min(1).max(200),
});

export const consoleRemoveListItemInputSchema = consoleSecretInputSchema.extend({
  itemId: z.string().min(1),
});

export const consoleWeatherInputSchema = consoleSecretInputSchema.extend({
  locationQuery: z.string().min(1).max(100),
});

export const consoleThreadListInputSchema = consoleSecretInputSchema;

export const consoleThreadInputSchema = consoleSecretInputSchema.extend({
  threadId: z.string().min(1).max(100),
  maxContentBytes: z.number().int().min(1_000).max(100_000).optional(),
});

export const consoleDocumentInputSchema = consoleSecretInputSchema.extend({
  documentKey: z.string().min(1).max(300),
});
