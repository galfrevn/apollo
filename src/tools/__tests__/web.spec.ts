import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { webSearchTool } from '@/tools/web';

describe('webSearchTool', () => {
  it('fails clearly when there are no usable sources', async () => {
    const result = await webSearchTool.handler(
      { query: 'algo inexistente' },
      {
        environment: createFakeApolloEnvironment({
          OPENROUTER_API_KEY: 'key',
          WEBSEARCH: Object.assign({} as Env['WEBSEARCH'], {
            search: async () => ({
              items: [],
              metadata: { query: 'x', requestId: 'r', latencyMs: 1 },
            }),
          }),
        }),
        nowMilliseconds: 1,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.summary.toLowerCase()).toContain('no');
  });

  it('returns synthesized answer when sources are available', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL) => {
        const requestUrl =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        if (requestUrl.includes('openrouter.ai')) {
          return new Response(
            JSON.stringify({
              choices: [{ message: { content: 'La capital de Francia es París.' } }],
            }),
            { status: 200 },
          );
        }
        return new Response(
          '<html><body>París es la capital de Francia.</body></html>',
          {
            status: 200,
            headers: { 'Content-Type': 'text/html' },
          },
        );
      },
      { preconnect: () => {} },
    ) as typeof fetch;

    try {
      const result = await webSearchTool.handler(
        { query: 'capital de Francia' },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            WEBSEARCH: Object.assign({} as Env['WEBSEARCH'], {
              search: async () => ({
                items: [
                  {
                    url: 'https://example.com/france',
                    title: 'Francia',
                    description: 'Datos sobre Francia',
                  },
                ],
                metadata: {
                  query: 'capital de Francia',
                  requestId: 'r',
                  latencyMs: 1,
                },
              }),
            }),
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
      globalThis.fetch = originalFetch;
    }
  });
});
