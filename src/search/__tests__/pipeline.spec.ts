import { describe, expect, it } from 'bun:test';

import { collectFetchedSourceList } from '@/search/pipeline';

describe('collectFetchedSourceList', () => {
  it('skips failed fetches and keeps successful pages', async () => {
    const sourceList = await collectFetchedSourceList({
      webSearch: {
        search: async () => ({
          items: [
            { url: 'https://ok.example', title: 'OK' },
            { url: 'https://bad.example', title: 'BAD' },
          ],
          metadata: { query: 'q', requestId: 'r', latencyMs: 1 },
        }),
      },
      queryList: ['q'],
      maxPages: 5,
      fetchImplementation: Object.assign(
        async (input: RequestInfo | URL) => {
          const url = String(input);
          if (url.includes('bad')) {
            return new Response('nope', { status: 500 });
          }
          return new Response('<p>contenido util suficiente</p>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          });
        },
        { preconnect: () => {} },
      ) as typeof fetch,
    });
    expect(sourceList).toHaveLength(1);
    expect(sourceList[0]?.url).toBe('https://ok.example');
    expect(sourceList[0]?.text).toContain('contenido');
  });
});
