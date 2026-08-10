import { z } from 'zod';

export const notifyBackgroundResultInputSchema = z.object({
  prompt: z.string().min(1),
  summary: z.string().min(1),
  documentKey: z.string().min(1).optional(),
});

export const deliverReminderPayloadSchema = z.object({
  message: z.string().min(1),
});

export const expireConfirmPayloadSchema = z.object({
  confirmationId: z.string().min(1),
});
