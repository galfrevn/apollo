import { z } from 'zod';

export const consoleSecretInputSchema = z.object({
  secret: z.string().min(1),
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
