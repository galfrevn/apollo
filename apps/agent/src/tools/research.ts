import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';

const startResearchArgsSchema = z.object({
  prompt: z.string().min(1).max(4000),
});

export const startResearchTool: ToolDefinition = {
  name: 'start_research',
  safety: 'safe',
  description: 'Encola una investigación en segundo plano',
  parameters: {
    type: 'object',
    properties: { prompt: { type: 'string' } },
    required: ['prompt'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = startResearchArgsSchema.parse(args);
    await context.effects.enqueueResearch(parsedArgs.prompt);

    return {
      ok: true,
      summary: 'Investigación encolada en segundo plano',
    };
  },
};
