import { describe, expect, it } from 'bun:test';

import { fetchPageText } from '@/search/fetch';

function createTypedFetchMock(
  body: string,
  status = 200,
  contentType = 'text/html',
): typeof fetch {
  const fetchHandler = async (): Promise<Response> =>
    new Response(body, {
      status,
      headers: { 'content-type': contentType },
    });
  return Object.assign(fetchHandler, { preconnect: () => {} }) as typeof fetch;
}

describe('fetchPageText', () => {
  it('returns truncated text for html responses', async () => {
    const result = await fetchPageText({
      pageUrl: 'https://example.com/a',
      maxTextCharacters: 10,
      fetchImplementation: createTypedFetchMock('<p>abcdefghijklmnop</p>'),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text.length).toBeLessThanOrEqual(10);
    }
  });

  it('fails on non-ok status', async () => {
    const result = await fetchPageText({
      pageUrl: 'https://example.com/missing',
      fetchImplementation: createTypedFetchMock('nope', 404),
    });
    expect(result.ok).toBe(false);
  });
});
