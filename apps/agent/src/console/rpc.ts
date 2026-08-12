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
