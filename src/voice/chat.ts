// The OpenAI chat-completions wire shape is the lingua franca between the turn
// loop and every provider transport: keeping messages in that shape end to end
// lets tool calls round-trip without translation.
export type ChatMessage =
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

export type ChatToolCall = {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
};

export type ChatToolDefinition = {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
};

export type ChatResult = {
  readonly text: string;
  readonly toolCallList: readonly ChatToolCall[];
};
