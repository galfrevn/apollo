import { describe, expect, it } from 'bun:test';

import { buildResearchDocumentObjectKey } from '@/search/keys';
import { dedupeWebPageUrlList, searchWebPages } from '@/search/web';

describe('search web helpers', () => {
  it('maps WEBSEARCH items and dedupes by url', async () => {
    const pageList = await searchWebPages({
      webSearch: {
        search: async () => ({
          items: [
            { url: 'https://a.example', title: 'A', description: 'da' },
            { url: 'https://a.example', title: 'A2' },
            { url: 'https://b.example', title: 'B' },
          ],
          metadata: { query: 'q', requestId: 'r', latencyMs: 1 },
        }),
      },
      query: 'q',
      limit: 10,
    });
    expect(dedupeWebPageUrlList(pageList, 10)).toEqual([
      { url: 'https://a.example', title: 'A', description: 'da' },
      { url: 'https://b.example', title: 'B', description: '' },
    ]);
  });

  it('builds research object keys', () => {
    expect(buildResearchDocumentObjectKey('desk1', 'inst9')).toBe(
      'research/desk1/inst9.md',
    );
  });
});
