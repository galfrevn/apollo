import { z } from 'zod';

export type OpenRouterToolCall = {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
};

export type OpenRouterChatMessage =
  | { readonly role: 'system'; readonly content: string }
  | { readonly role: 'user'; readonly content: string }
  | {
      readonly role: 'assistant';
      readonly content: string | null;
      readonly tool_calls?: readonly {
        readonly id: string;
        readonly type: 'function';
        readonly function: {
          readonly name: string;
          readonly arguments: string;
        };
      }[];
    }
  | {
      readonly role: 'tool';
      readonly tool_call_id: string;
      readonly content: string;
    };

export type OpenRouterChatResult = {
  readonly text: string;
  readonly toolCallList: readonly OpenRouterToolCall[];
};

const openRouterChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable().optional(),
          tool_calls: z
            .array(
              z.object({
                id: z.string(),
                function: z.object({
                  name: z.string(),
                  arguments: z.string(),
                }),
              }),
            )
            .optional(),
        }),
      }),
    )
    .min(1),
});

export function buildOpenRouterSystemPrompt(input: {
  readonly soulSystemPrompt: string;
  readonly memoryContentList: readonly string[];
  readonly isFocusActive: boolean;
}): string {
  const memoryBlock =
    input.memoryContentList.length === 0
      ? 'Sin memorias relevantes.'
      : input.memoryContentList.map((content) => `- ${content}`).join('\n');
  const focusBlock = input.isFocusActive
    ? 'Focus activo: evitá announces ruidosos; sé breve.'
    : 'Focus inactivo.';

  return [
    input.soulSystemPrompt,
    '',
    'Memorias relevantes:',
    memoryBlock,
    '',
    focusBlock,
  ].join('\n');
}

export async function chatWithOpenRouter(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly messageList: readonly OpenRouterChatMessage[];
  readonly toolDefinitionList?: readonly {
    readonly name: string;
    readonly description: string;
    readonly parameters: Record<string, unknown>;
  }[];
}): Promise<OpenRouterChatResult> {
  const toolDefinitionPayloadList =
    input.toolDefinitionList !== undefined && input.toolDefinitionList.length > 0
      ? input.toolDefinitionList.map((toolDefinition) => ({
          type: 'function' as const,
          function: {
            name: toolDefinition.name,
            description: toolDefinition.description,
            parameters: toolDefinition.parameters,
          },
        }))
      : undefined;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.modelId,
      messages: input.messageList,
      ...(toolDefinitionPayloadList !== undefined
        ? { tools: toolDefinitionPayloadList }
        : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`LLM falló con status ${response.status}`);
  }

  const payload = openRouterChatResponseSchema.parse(await response.json());
  const message = payload.choices[0].message;
  const toolCallList =
    message.tool_calls?.map((toolCall) => ({
      id: toolCall.id,
      name: toolCall.function.name,
      args: JSON.parse(toolCall.function.arguments) as unknown,
    })) ?? [];

  return {
    text: message.content?.trim() ?? '',
    toolCallList,
  };
}
