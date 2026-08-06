import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { recallMemoryTool } from '@/tools/memory';

describe('recallMemoryTool', () => {
  it('returns matched memories from Vectorize', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }] }),
          { status: 200 },
        ),
      { preconnect: () => {} },
    ) as typeof fetch;

    try {
      const result = await recallMemoryTool.handler(
        { query: 'mate', limit: 3 },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            VECTORIZE: Object.assign({} as Env['VECTORIZE'], {
              query: async () => ({
                matches: [
                  {
                    id: 'm1',
                    score: 0.91,
                    metadata: { content: 'tomo mate a la tarde' },
                  },
                ],
                count: 1,
              }),
            }),
          }),
          nowMilliseconds: 1,
          deviceId: 'desk1',
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('tomo mate');
      expect(result.data).toMatchObject({
        matchList: [{ content: 'tomo mate a la tarde', score: 0.91 }],
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('reports empty recall honestly', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = Object.assign(
      async () =>
        new Response(
          JSON.stringify({ data: [{ embedding: [0.1] }] }),
          { status: 200 },
        ),
      { preconnect: () => {} },
    ) as typeof fetch;
    try {
      const result = await recallMemoryTool.handler(
        { query: 'xyz' },
        {
          environment: createFakeApolloEnvironment({
            OPENROUTER_API_KEY: 'key',
            VECTORIZE: Object.assign({} as Env['VECTORIZE'], {
              query: async () => ({ matches: [], count: 0 }),
            }),
          }),
          nowMilliseconds: 1,
          deviceId: 'desk1',
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('No encontré');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
