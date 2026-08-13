import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';

const recallConversationArgsSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export const recallConversationTool: ToolDefinition = {
  name: 'recall_conversation',
  safety: 'safe',
  description:
    'Busca en conversaciones pasadas con el dueño (otros hilos, otros días) por texto',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = recallConversationArgsSchema.parse(args);
    const matchList = await context.effects.searchThreadHistory({
      query: parsedArgs.query,
      limit: parsedArgs.limit,
    });
    if (matchList.length === 0) {
      return {
        ok: true,
        summary: `No encontré conversaciones pasadas sobre ${parsedArgs.query}`,
        data: { matchList: [] },
      };
    }
    return {
      ok: true,
      summary: `Encontré ${matchList.length} momentos: ${matchList
        .map(
          (match) => `${match.role === 'user' ? 'Usuario' : 'Apollo'}: ${match.content}`,
        )
        .join(' | ')}`,
      data: { matchList },
    };
  },
};

const resumeConversationArgsSchema = z.object({
  query: z.string().min(1).max(500),
});

export const resumeConversationTool: ToolDefinition = {
  name: 'resume_conversation',
  safety: 'safe',
  description:
    'Retoma una conversación pasada: la vuelve el hilo activo y trae su resumen. Usalo cuando el dueño pide seguir con un tema anterior',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = resumeConversationArgsSchema.parse(args);
    const resumedThread = await context.effects.resumeConversationThread({
      query: parsedArgs.query,
    });
    if (resumedThread === undefined) {
      return {
        ok: true,
        summary: `No encontré una conversación anterior sobre ${parsedArgs.query}`,
      };
    }
    return {
      ok: true,
      summary:
        resumedThread.summary === null
          ? `Retomo la conversación "${resumedThread.title}".`
          : `Retomo la conversación "${resumedThread.title}". Resumen: ${resumedThread.summary}`,
      data: resumedThread,
    };
  },
};
