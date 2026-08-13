import { z } from 'zod';

import {
  jsonSerializableValueSchema,
  type JsonSerializableValue,
  type ToolDefinition,
} from '@/tools/types';

export type OpenRouterToolCall = {
  readonly id: string;
  readonly name: string;
  readonly args: JsonSerializableValue;
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

export function buildSemanticMemoryPromptNote(
  semanticMemoryContentList: readonly string[],
): string {
  if (semanticMemoryContentList.length === 0) {
    return '';
  }
  const semanticMemoryBlock = semanticMemoryContentList
    .map((content) => `- ${content}`)
    .join('\n');
  return `\n\nRecall semántico (Vectorize):\n${semanticMemoryBlock}`;
}

const openRouterStreamChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: z
          .object({
            content: z.string().nullable().optional(),
            tool_calls: z
              .array(
                z.object({
                  index: z.number(),
                  id: z.string().nullable().optional(),
                  function: z
                    .object({
                      name: z.string().nullable().optional(),
                      arguments: z.string().nullable().optional(),
                    })
                    .optional(),
                }),
              )
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

async function consumeOpenRouterStream(
  response: Response,
  onTextDelta: (deltaText: string) => void,
): Promise<OpenRouterChatResult> {
  const bodyReader = response.body?.getReader();
  if (bodyReader === undefined) {
    throw new Error('LLM en streaming sin body');
  }

  const partialToolCallMap = new Map<
    number,
    { id: string; name: string; argumentsText: string }
  >();
  let fullText = '';
  let pendingLineBuffer = '';
  const textDecoder = new TextDecoder();

  const handleDataLine = (dataText: string): void => {
    const chunk = openRouterStreamChunkSchema.parse(JSON.parse(dataText));
    const delta = chunk.choices?.[0]?.delta;
    if (delta === undefined) {
      return;
    }
    if (delta.content !== undefined && delta.content !== null && delta.content !== '') {
      fullText += delta.content;
      onTextDelta(delta.content);
    }
    for (const toolCallDelta of delta.tool_calls ?? []) {
      const partial = partialToolCallMap.get(toolCallDelta.index) ?? {
        id: '',
        name: '',
        argumentsText: '',
      };
      partial.id = toolCallDelta.id ?? partial.id;
      partial.name = toolCallDelta.function?.name ?? partial.name;
      partial.argumentsText += toolCallDelta.function?.arguments ?? '';
      partialToolCallMap.set(toolCallDelta.index, partial);
    }
  };

  const handleLine = (line: string): void => {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('data: ') || trimmedLine === 'data: [DONE]') {
      return;
    }
    handleDataLine(trimmedLine.slice('data: '.length));
  };

  for (;;) {
    const { done, value } = await bodyReader.read();
    if (done) {
      break;
    }
    pendingLineBuffer += textDecoder.decode(value, { stream: true });
    const lineList = pendingLineBuffer.split('\n');
    pendingLineBuffer = lineList.pop() ?? '';
    for (const line of lineList) {
      handleLine(line);
    }
  }

  // A stream that ends without a trailing newline leaves its last event in the
  // buffer; dropping it would silently truncate the reply.
  handleLine(pendingLineBuffer + textDecoder.decode());

  const toolCallList = [...partialToolCallMap.entries()]
    .toSorted(([leftIndex], [rightIndex]) => leftIndex - rightIndex)
    .map(([, partial]) => {
      const parsedArguments = jsonSerializableValueSchema.parse(
        JSON.parse(partial.argumentsText === '' ? '{}' : partial.argumentsText),
      );
      return { id: partial.id, name: partial.name, args: parsedArguments };
    });

  return { text: fullText.trim(), toolCallList };
}

type OpenRouterChatRequestPayload = {
  readonly model: string;
  readonly messages: readonly OpenRouterChatMessage[];
  tools?: readonly {
    readonly type: 'function';
    readonly function: Pick<ToolDefinition, 'name' | 'description' | 'parameters'>;
  }[];
  stream?: boolean;
};

export async function chatWithOpenRouter(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly messageList: readonly OpenRouterChatMessage[];
  readonly toolDefinitionList?: readonly Pick<
    ToolDefinition,
    'name' | 'description' | 'parameters'
  >[];
  // When given, the request streams over SSE and every content delta lands here
  // as it arrives, so the caller can start speaking the first sentence while
  // the model is still writing the rest.
  readonly onTextDelta?: (deltaText: string) => void;
  readonly fetchImplementation?: typeof fetch;
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

  const requestPayload: OpenRouterChatRequestPayload = {
    model: input.modelId,
    messages: input.messageList,
  };
  if (toolDefinitionPayloadList !== undefined) {
    requestPayload.tools = toolDefinitionPayloadList;
  }
  if (input.onTextDelta !== undefined) {
    requestPayload.stream = true;
  }

  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    },
  );

  if (!response.ok) {
    throw new Error(`LLM falló con status ${response.status}`);
  }

  if (input.onTextDelta !== undefined) {
    return consumeOpenRouterStream(response, input.onTextDelta);
  }

  const payload = openRouterChatResponseSchema.parse(await response.json());
  const message = payload.choices[0].message;
  const toolCallList =
    message.tool_calls?.map((toolCall) => {
      const parsedArguments = jsonSerializableValueSchema.parse(
        JSON.parse(toolCall.function.arguments),
      );
      return { id: toolCall.id, name: toolCall.function.name, args: parsedArguments };
    }) ?? [];

  return {
    text: message.content?.trim() ?? '',
    toolCallList,
  };
}
