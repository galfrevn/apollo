import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { webSearchTool } from '@/tools/web';

function withMockedFetch(handler: (requestUrl: string) => Response): {
  restore: () => void;
} {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = Object.assign(
    async (input: RequestInfo | URL) => {
      const requestUrl =
        typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      return handler(requestUrl);
    },
    { preconnect: () => {} },
  ) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

describe('webSearchTool', () => {
  it('fails clearly when there are no usable sources', async () => {
    const mocked = withMockedFetch(
      () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );
    try {
      const result = await webSearchTool.handler(
        { query: 'algo inexistente' },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            TAVILY_API_KEY: 'tvly-key',
          }),
          nowMilliseconds: 1,
        },
      );
      expect(result.ok).toBe(false);
      expect(result.summary.toLowerCase()).toContain('no');
    } finally {
      mocked.restore();
    }
  });

  it('returns synthesized answer when sources are available', async () => {
    const mocked = withMockedFetch((requestUrl) => {
      if (requestUrl.includes('openrouter.ai')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'La capital de Francia es París.' } }],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          results: [
            {
              url: 'https://example.com/france',
              title: 'Francia',
              content: 'París es la capital de Francia.',
              raw_content: null,
            },
          ],
        }),
        { status: 200 },
      );
    });

    try {
      const result = await webSearchTool.handler(
        { query: 'capital de Francia' },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            TAVILY_API_KEY: 'tvly-key',
          }),
          nowMilliseconds: 1,
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('París');
      expect(result.data).toMatchObject({
        sourceList: [{ url: 'https://example.com/france', title: 'Francia' }],
      });
    } finally {
      mocked.restore();
    }
  });

  it('surfaces a search failure without throwing', async () => {
    const mocked = withMockedFetch(() => new Response('{}', { status: 401 }));
    try {
      const result = await webSearchTool.handler(
        { query: 'algo' },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            TAVILY_API_KEY: 'tvly-invalida',
          }),
          nowMilliseconds: 1,
        },
      );
      expect(result.ok).toBe(false);
      expect(result.summary).toContain('Falló la búsqueda web');
    } finally {
      mocked.restore();
    }
  });
});
