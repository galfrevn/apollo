import { z } from 'zod';

import { resolveApolloConfiguration } from '@/configuration/resolve';
import { formatCurrentDateTimeForPrompt } from '@/persona/clock';
import { synthesizeQuickWebAnswer } from '@/search/synthesize';
import { searchWebSourcesWithTavily } from '@/search/tavily';
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
      const sourceList = await searchWebSourcesWithTavily({
        tavilyApiKey: context.environment.TAVILY_API_KEY,
        query: parsedArgs.query,
        maxResults: 5,
      });
      if (sourceList.length === 0) {
        return {
          ok: false,
          summary: 'No encontré fuentes web útiles para esa búsqueda',
        };
      }
      const answerText = await synthesizeQuickWebAnswer({
        openRouterApiKey: context.environment.OPENROUTER_API_KEY,
        modelId: resolveApolloConfiguration(context.environment).models.conversation,
        query: parsedArgs.query,
        currentDateText: formatCurrentDateTimeForPrompt(context.nowMilliseconds),
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
