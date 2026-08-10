import { z } from 'zod';

import { sendEmailWithResend } from '@/notifications/email';
import type { ToolDefinition } from '@/tools/types';

const sendEmailArgsSchema = z.object({
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
});

// Safe without confirmation because the recipient is pinned to the owner's
// address (APOLLO_OWNER_EMAIL): the model cannot email anyone else.
export const sendEmailTool: ToolDefinition = {
  name: 'send_email',
  safety: 'safe',
  description: 'Te manda un email a tu propia casilla con el asunto y texto dados',
  parameters: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      body: { type: 'string' },
    },
    required: ['subject', 'body'],
    additionalProperties: false,
  },
  async handler(args, context) {
    const parsedArgs = sendEmailArgsSchema.parse(args);
    if (!context.environment.RESEND_API_KEY) {
      return {
        ok: false,
        summary: 'El email no está configurado todavía (falta RESEND_API_KEY).',
      };
    }
    try {
      await sendEmailWithResend({
        resendApiKey: context.environment.RESEND_API_KEY,
        toAddress: context.environment.APOLLO_OWNER_EMAIL,
        subject: parsedArgs.subject,
        textBody: parsedArgs.body,
      });
      return {
        ok: true,
        summary: `Email mandado: ${parsedArgs.subject}`,
      };
    } catch (error) {
      return {
        ok: false,
        summary:
          error instanceof Error
            ? `No pude mandar el email: ${error.message}`
            : 'No pude mandar el email',
      };
    }
  },
};
