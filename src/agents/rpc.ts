import { z } from 'zod';

import { initiativePrioritySchema, initiativeSourceSchema } from '@/initiative/logic';
import { deskSoundEffectSchema } from '@/protocol/schema';

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

export const retryInitiativeUtterancePayloadSchema = z.object({
  source: initiativeSourceSchema,
  priority: initiativePrioritySchema,
  message: z.string().min(1),
  earconName: deskSoundEffectSchema.optional(),
  deferCount: z.number().int().min(0).max(5),
});
