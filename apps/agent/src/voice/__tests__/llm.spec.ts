import { describe, expect, it } from 'bun:test';

import { buildOpenRouterSystemPrompt, chatWithOpenRouter } from '@/voice/llm';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

function createCapturingFetchMock(
  responseBody: unknown,
  status = 200,
): {
  readonly fetchImplementation: typeof fetch;
  readonly callList: CapturedFetchCall[];
} {
  const callList: CapturedFetchCall[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callList.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), { status });
  };
  return {
    fetchImplementation: Object.assign(fetchHandler, {
      preconnect: () => {},
    }) as typeof fetch,
    callList,
  };
}

describe('buildOpenRouterSystemPrompt', () => {
  it('lists memories when present', () => {
    const prompt = buildOpenRouterSystemPrompt({
      soulSystemPrompt: 'Sos Apollo.',
      memoryContentList: ['toma mate', 'vive en Buenos Aires'],
      isFocusActive: false,
    });
    expect(prompt).toContain('toma mate');
    expect(prompt).toContain('vive en Buenos Aires');
    expect(prompt).toContain('Focus inactivo.');
  });

  it('notes the absence of memories and an active focus', () => {
    const prompt = buildOpenRouterSystemPrompt({
      soulSystemPrompt: 'Sos Apollo.',
      memoryContentList: [],
      isFocusActive: true,
    });
    expect(prompt).toContain('Sin memorias relevantes.');
    expect(prompt).toContain('Focus activo');
  });
});

describe('chatWithOpenRouter', () => {
  it('sends the model and messages, omitting tools when none are given', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock({
      choices: [{ message: { content: 'hola' } }],
    });

    const result = await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'deepseek/deepseek-v4-flash-0731',
      messageList: [{ role: 'user', content: 'hola' }],
      fetchImplementation,
    });

    expect(result.text).toBe('hola');
    expect(result.toolCallList).toEqual([]);
    expect(callList).toHaveLength(1);
    expect(callList[0].url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(callList[0].init.headers).toMatchObject({ Authorization: 'Bearer key-123' });
    const requestBody = JSON.parse(callList[0].init.body as string) as Record<
      string,
      unknown
    >;
    expect(requestBody.model).toBe('deepseek/deepseek-v4-flash-0731');
    expect(requestBody.tools).toBeUndefined();
  });

  it('includes a tools payload when tool definitions are given', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock({
      choices: [{ message: { content: 'listo' } }],
    });

    await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'model-x',
      messageList: [{ role: 'user', content: 'hacé algo' }],
      toolDefinitionList: [
        { name: 'weather_now', description: 'clima', parameters: { type: 'object' } },
      ],
      fetchImplementation,
    });

    const requestBody = JSON.parse(callList[0].init.body as string) as {
      tools?: readonly { function: { name: string } }[];
    };
    expect(requestBody.tools?.[0]?.function.name).toBe('weather_now');
  });

  it('maps tool_calls into toolCallList with parsed args', async () => {
    const { fetchImplementation } = createCapturingFetchMock({
      choices: [
        {
          message: {
            content: null,
            tool_calls: [
              {
                id: 'call-1',
                function: {
                  name: 'weather_now',
                  arguments: '{"locationQuery":"Rosario"}',
                },
              },
            ],
          },
        },
      ],
    });

    const result = await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'model-x',
      messageList: [{ role: 'user', content: 'clima en Rosario' }],
      fetchImplementation,
    });

    expect(result.text).toBe('');
    expect(result.toolCallList).toEqual([
      { id: 'call-1', name: 'weather_now', args: { locationQuery: 'Rosario' } },
    ]);
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock({}, 500);
    await expect(
      chatWithOpenRouter({
        openRouterApiKey: 'key-123',
        modelId: 'model-x',
        messageList: [{ role: 'user', content: 'hola' }],
        fetchImplementation,
      }),
    ).rejects.toThrow('LLM falló con status 500');
  });

  it('streams content deltas and reassembles the full text', async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Hola "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"mundo."}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const callList: CapturedFetchCall[] = [];
    const fetchImplementation = Object.assign(
      async (input: string | URL | Request, init?: RequestInit) => {
        callList.push({ url: String(input), init: init ?? {} });
        return new Response(sseBody, { status: 200 });
      },
      { preconnect: () => {} },
    ) as typeof fetch;

    const deltaList: string[] = [];
    const result = await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'model-x',
      messageList: [{ role: 'user', content: 'hola' }],
      onTextDelta: (deltaText) => {
        deltaList.push(deltaText);
      },
      fetchImplementation,
    });

    const requestBody = JSON.parse(callList[0].init.body as string) as {
      stream?: boolean;
    };
    expect(requestBody.stream).toBe(true);
    expect(deltaList).toEqual(['Hola ', 'mundo.']);
    expect(result.text).toBe('Hola mundo.');
    expect(result.toolCallList).toEqual([]);
  });

  it('keeps the last event when the stream ends without a trailing newline', async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"content":"Hola "}}]}',
      '',
      'data: {"choices":[{"delta":{"content":"mundo."}}]}',
    ].join('\n');
    const fetchImplementation = Object.assign(
      async () => new Response(sseBody, { status: 200 }),
      { preconnect: () => {} },
    ) as typeof fetch;

    const result = await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'model-x',
      messageList: [{ role: 'user', content: 'hola' }],
      onTextDelta: () => {},
      fetchImplementation,
    });

    expect(result.text).toBe('Hola mundo.');
  });

  it('accumulates streamed tool call fragments into parsed calls', async () => {
    const sseBody = [
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call-1","function":{"name":"weather_now","arguments":"{\\"locationQuery\\":"}}]}}]}',
      '',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Rosario\\"}"}}]}}]}',
      '',
      'data: [DONE]',
      '',
    ].join('\n');
    const fetchImplementation = Object.assign(
      async () => new Response(sseBody, { status: 200 }),
      { preconnect: () => {} },
    ) as typeof fetch;

    const result = await chatWithOpenRouter({
      openRouterApiKey: 'key-123',
      modelId: 'model-x',
      messageList: [{ role: 'user', content: 'clima' }],
      onTextDelta: () => {},
      fetchImplementation,
    });

    expect(result.text).toBe('');
    expect(result.toolCallList).toEqual([
      { id: 'call-1', name: 'weather_now', args: { locationQuery: 'Rosario' } },
    ]);
  });

  it('throws when the response does not match the expected schema', async () => {
    const { fetchImplementation } = createCapturingFetchMock({ choices: [] });
    await expect(
      chatWithOpenRouter({
        openRouterApiKey: 'key-123',
        modelId: 'model-x',
        messageList: [{ role: 'user', content: 'hola' }],
        fetchImplementation,
      }),
    ).rejects.toThrow();
  });
});
