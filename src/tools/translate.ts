import { z } from 'zod';

import { resolveApolloConfiguration } from '@/configuration/resolve';
import type { ToolDefinition } from '@/tools/types';
import { chatWithOpenRouter } from '@/voice/llm';

const translateArgsSchema = z.object({
  text: z.string().min(1).max(8000),
  targetLanguage: z.string().min(1).max(80),
  sourceLanguage: z.string().min(1).max(80).optional(),
});

export const translateTool: ToolDefinition = {
  name: 'translate',
  safety: 'safe',
  description: 'Traduce texto a cualquier idioma con IA',
  parameters: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      targetLanguage: { type: 'string' },
      sourceLanguage: { type: 'string' },
    },
    required: ['text', 'targetLanguage'],
    additionalProperties: false,
  },
  async handler(args, context) {
    const parsedArgs = translateArgsSchema.parse(args);
    const sourceClause =
      parsedArgs.sourceLanguage === undefined
        ? 'Detectá el idioma de origen.'
        : `Idioma de origen: ${parsedArgs.sourceLanguage}.`;

    try {
      const chatResult = await chatWithOpenRouter({
        openRouterApiKey: context.environment.OPENROUTER_API_KEY,
        modelId: resolveApolloConfiguration(context.environment).models.conversation,
        messageList: [
          {
            role: 'system',
            content: `Traducí el texto del usuario. ${sourceClause} Idioma destino: ${parsedArgs.targetLanguage}. Respondé SOLO con la traducción, sin comillas ni explicación.`,
          },
          { role: 'user', content: parsedArgs.text },
        ],
      });
      const translatedText = chatResult.text.trim();
      if (translatedText.length === 0) {
        return { ok: false, summary: 'La traducción vino vacía' };
      }
      return {
        ok: true,
        summary: translatedText,
        data: {
          translatedText,
          targetLanguage: parsedArgs.targetLanguage,
        },
      };
    } catch (error) {
      return {
        ok: false,
        summary:
          error instanceof Error
            ? `No pude traducir: ${error.message}`
            : 'No pude traducir',
      };
    }
  },
};
