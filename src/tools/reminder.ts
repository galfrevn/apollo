import { z } from 'zod';

import {
  formatCancelRemindersSummary,
  formatListRemindersSummary,
} from '@/reminders/logic';
import type { ToolDefinition } from '@/tools/types';

const setReminderArgsSchema = z.object({
  message: z.string().min(1).max(500),
  delaySeconds: z.number().int().min(1).max(86400),
});

const cancelReminderArgsSchema = z
  .object({
    message: z.string().min(1).max(500).optional(),
    cancelAll: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.cancelAll !== true &&
      (value.message === undefined || value.message.trim() === '')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'message or cancelAll required',
      });
    }
  });

export const setReminderTool: ToolDefinition = {
  name: 'set_reminder',
  safety: 'safe',
  description: 'Programa un recordatorio para más tarde',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      delaySeconds: { type: 'number', minimum: 1, maximum: 86400 },
    },
    required: ['message', 'delaySeconds'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = setReminderArgsSchema.parse(args);
    await context.effects.scheduleReminder({
      delaySeconds: parsedArgs.delaySeconds,
      message: parsedArgs.message,
    });

    return {
      ok: true,
      summary: `Recordatorio programado: ${parsedArgs.message}`,
    };
  },
};

export const listRemindersTool: ToolDefinition = {
  name: 'list_reminders',
  safety: 'safe',
  description: 'Lista los recordatorios pendientes',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(_args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const reminderList = await context.effects.listReminders();
    return {
      ok: true,
      summary: formatListRemindersSummary(reminderList, context.nowMilliseconds),
      data: reminderList,
    };
  },
};

export const cancelReminderTool: ToolDefinition = {
  name: 'cancel_reminder',
  safety: 'safe',
  description: 'Cancela recordatorios por mensaje parcial o todos',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      cancelAll: { type: 'boolean' },
    },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgsResult = cancelReminderArgsSchema.safeParse(args);
    if (!parsedArgsResult.success) {
      return {
        ok: false,
        summary: 'Indicá un mensaje o cancelAll',
      };
    }

    const parsedArgs = parsedArgsResult.data;
    const isCancelAll = parsedArgs.cancelAll === true;
    const cancelResult = await context.effects.cancelReminders({
      message: parsedArgs.message,
      cancelAll: isCancelAll,
    });

    const summary = formatCancelRemindersSummary({
      cancelledMessageList: cancelResult.cancelledMessageList,
      searchedMessage: isCancelAll ? undefined : parsedArgs.message,
    });

    if (isCancelAll) {
      return { ok: true, summary, data: cancelResult };
    }

    return {
      ok: cancelResult.cancelledCount > 0,
      summary,
      data: cancelResult,
    };
  },
};
