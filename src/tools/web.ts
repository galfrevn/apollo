import { z } from 'zod';

import { collectFetchedSourceList } from '@/search/pipeline';
import { synthesizeQuickWebAnswer } from '@/search/synthesize';
import type { ToolDefinition } from '@/tools/types';

const webSearchArgsSchema = z.object({
  query: z.string().min(1).max(500),
});

export const webSearchTool: ToolDefinition = {
  name: 'web_search',
  safety: 'safe',
  description:
    'Búsqueda web rápida para hechos puntuales; devuelve respuesta corta con fuentes',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
    additionalProperties: false,
  },
  async handler(args, context) {
    const parsedArgs = webSearchArgsSchema.parse(args);
    try {
      const sourceList = await collectFetchedSourceList({
        webSearch: context.environment.WEBSEARCH,
        queryList: [parsedArgs.query],
        maxPages: 3,
        resultsPerQuery: 5,
      });
      if (sourceList.length === 0) {
        return {
          ok: false,
          summary: 'No encontré fuentes web útiles para esa búsqueda',
        };
      }
      const answerText = await synthesizeQuickWebAnswer({
        openRouterApiKey: context.environment.OPENROUTER_API_KEY,
        modelId: context.environment.OPENROUTER_MODEL,
        query: parsedArgs.query,
        sourceList,
      });
      return {
        ok: true,
        summary: answerText,
        data: {
          sourceList: sourceList.map((source) => ({
            url: source.url,
            title: source.title,
          })),
        },
      };
    } catch (error) {
      return {
        ok: false,
        summary:
          error instanceof Error
            ? `Falló la búsqueda web: ${error.message}`
            : 'Falló la búsqueda web',
      };
    }
  },
};
