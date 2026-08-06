import { z } from 'zod';

export const notifyBackgroundResultInputSchema = z.object({
  prompt: z.string().min(1),
  summary: z.string().min(1),
  documentKey: z.string().min(1).optional(),
});

export type NotifyBackgroundResultInput = z.infer<
  typeof notifyBackgroundResultInputSchema
>;

export const deliverReminderPayloadSchema = z.object({
  message: z.string().min(1),
});

export type DeliverReminderPayload = z.infer<typeof deliverReminderPayloadSchema>;
