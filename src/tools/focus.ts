import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';

const setFocusArgsSchema = z.object({
  minutes: z.number().int().min(1).max(180).default(25),
});

const clearFocusArgsSchema = z.object({});

export const setFocusTool: ToolDefinition = {
  name: 'set_focus',
  safety: 'safe',
  description: 'Activa modo foco por una cantidad de minutos',
  parameters: {
    type: 'object',
    properties: {
      minutes: { type: 'number', minimum: 1, maximum: 180 },
    },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = setFocusArgsSchema.parse(args);
    await context.effects.applyFocusMinutes(parsedArgs.minutes);

    return {
      ok: true,
      summary: `Modo foco activado por ${parsedArgs.minutes} minutos`,
    };
  },
};

export const clearFocusTool: ToolDefinition = {
  name: 'clear_focus',
  safety: 'safe',
  description: 'Desactiva el modo foco',
  parameters: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    clearFocusArgsSchema.parse(args);
    await context.effects.clearFocus();

    return {
      ok: true,
      summary: 'Modo foco desactivado',
    };
  },
};
