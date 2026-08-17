import { afterEach, describe, expect, it } from 'bun:test';

import {
  synthesizeQuickWebAnswer,
  synthesizeResearchSpokenSummary,
} from '@/search/synthesize';

type ChatResponse = {
  readonly choices: readonly {
    readonly message: { readonly content: string | null };
  }[];
};

function createChatFetchMock(
  responseBody: ChatResponse,
  status = 200,
): { fetchImplementation: typeof fetch; requestList: string[] } {
  const requestList: string[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    requestList.push(String(init?.body ?? ''));
    return new Response(JSON.stringify(responseBody), { status });
  };
  return {
    fetchImplementation: Object.assign(fetchHandler, { preconnect: () => {} }),
    requestList,
  };
}

describe('synthesizeQuickWebAnswer', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('builds a dated source-grounded prompt and trims the response', async () => {
    const { fetchImplementation, requestList } = createChatFetchMock({
      choices: [{ message: { content: '  Respuesta breve.  ' } }],
    });
    globalThis.fetch = fetchImplementation;

    const answer = await synthesizeQuickWebAnswer({
      openRouterApiKey: 'key',
      modelId: 'model',
      query: '¿Qué pasó?',
      currentDateText: '16 de agosto de 2026',
      sourceList: [
        { url: 'https://example.com/news', title: 'Noticia', text: 'Contenido' },
      ],
    });

    expect(answer).toBe('Respuesta breve.');
    const request = JSON.parse(requestList[0]) as { messages: { content: string }[] };
    expect(request.messages[0].content).toContain('Hoy es 16 de agosto de 2026');
    expect(request.messages[1].content).toContain('[1] Noticia');
    expect(request.messages[1].content).toContain('https://example.com/news');
  });

  it('propagates an upstream status error', async () => {
    const { fetchImplementation } = createChatFetchMock({ choices: [] }, 503);
    globalThis.fetch = fetchImplementation;

    await expect(
      synthesizeQuickWebAnswer({
        openRouterApiKey: 'key',
        modelId: 'model',
        query: 'consulta',
        sourceList: [],
      }),
    ).rejects.toThrow('LLM falló con status 503');
  });
});

describe('synthesizeResearchSpokenSummary', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('limits the report included in the prompt and returns the spoken summary', async () => {
    const { fetchImplementation, requestList } = createChatFetchMock({
      choices: [{ message: { content: '  Informe guardado.  ' } }],
    });
    globalThis.fetch = fetchImplementation;
    const reportMarkdown = 'x'.repeat(8000);

    const summary = await synthesizeResearchSpokenSummary({
      openRouterApiKey: 'key',
      modelId: 'model',
      prompt: 'resumí esto',
      reportMarkdown,
    });

    expect(summary).toBe('Informe guardado.');
    const request = JSON.parse(requestList[0]) as { messages: { content: string }[] };
    expect(request.messages[1].content).toHaveLength(6030);
    expect(request.messages[1].content).toEndWith('x'.repeat(6000));
  });
});
