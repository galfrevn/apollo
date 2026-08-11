import { z } from 'zod';

import { resolveApolloConfiguration } from '@/configuration/resolve';
import type { ToolDefinition } from '@/tools/types';

const rememberFactArgsSchema = z.object({
  content: z.string().min(1).max(2000),
});

export const rememberFactTool: ToolDefinition = {
  name: 'remember_fact',
  safety: 'safe',
  description: 'Guarda un dato en la memoria del escritorio',
  parameters: {
    type: 'object',
    properties: { content: { type: 'string' } },
    required: ['content'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = rememberFactArgsSchema.parse(args);
    const persistedMemory = await context.effects.persistMemory(parsedArgs.content);

    return {
      ok: true,
      summary: `Recordado: ${persistedMemory.content}`,
      data: persistedMemory,
    };
  },
};

const recallMemoryArgsSchema = z.object({
  query: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(10).default(5),
});

export const recallMemoryTool: ToolDefinition = {
  name: 'recall_memory',
  safety: 'safe',
  description: 'Busca en la memoria semántica del escritorio',
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
    const parsedArgs = recallMemoryArgsSchema.parse(args);
    const deviceId = context.deviceId ?? 'default';

    try {
      const { embedTextWithOpenRouter, queryMemoryVectors } =
        await import('@/memory/vector');
      const values = await embedTextWithOpenRouter({
        openRouterApiKey: context.environment.OPENROUTER_API_KEY,
        modelId: resolveApolloConfiguration(context.environment).models.embedding,
        text: parsedArgs.query,
      });
      const matchList = await queryMemoryVectors({
        vectorizeIndex: context.environment.VECTORIZE,
        values,
        deviceId,
        topK: parsedArgs.limit,
      });
      const usableMatchList = matchList.filter((match) => match.content.length > 0);
      if (usableMatchList.length === 0) {
        return {
          ok: true,
          summary: `No encontré nada sobre ${parsedArgs.query}`,
          data: { matchList: [] },
        };
      }
      return {
        ok: true,
        summary: `Recordé ${usableMatchList.length} cosas: ${usableMatchList
          .map((match) => match.content)
          .join('; ')}`,
        data: {
          matchList: usableMatchList.map((match) => ({
            id: match.id,
            content: match.content,
            score: match.score,
          })),
        },
      };
    } catch (error) {
      return {
        ok: false,
        summary:
          error instanceof Error
            ? `No pude recordar: ${error.message}`
            : 'No pude recordar',
      };
    }
  },
};
