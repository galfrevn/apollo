import { describe, expect, it } from 'bun:test';

import { searchWebSourcesWithTavily } from '@/search/tavily';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

type TavilySearchResultFixture = {
  readonly url: string;
  readonly title: string;
  readonly content: string;
  readonly raw_content: string | null;
};

type TavilySearchResponseFixture = {
  readonly results?: readonly TavilySearchResultFixture[];
};

function createCapturingFetchMock(
  responseBody: TavilySearchResponseFixture,
  status = 200,
) {
  const callList: CapturedFetchCall[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callList.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), { status });
  };
  const fetchImplementation: typeof fetch = Object.assign(fetchHandler, {
    preconnect: () => {},
  });
  return { fetchImplementation, callList };
}

describe('searchWebSourcesWithTavily', () => {
  it('posts the query with raw content enabled and maps results to sources', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock({
      results: [
        {
          url: 'https://example.com/nota',
          title: 'La nota',
          content: 'resumen corto',
          raw_content: 'texto completo de la página',
        },
        {
          url: 'https://example.com/sin-raw',
          title: 'Sin raw',
          content: 'solo el snippet',
          raw_content: null,
        },
      ],
    });

    const sourceList = await searchWebSourcesWithTavily({
      tavilyApiKey: 'tvly-key',
      query: 'capital de Francia',
      fetchImplementation,
    });

    expect(callList[0].url).toBe('https://api.tavily.com/search');
    expect(callList[0].init.headers).toMatchObject({
      Authorization: 'Bearer tvly-key',
    });
    const capturedRequestBody: unknown = JSON.parse(String(callList[0].init.body));
    expect(capturedRequestBody).toEqual({
      query: 'capital de Francia',
      max_results: 5,
      include_raw_content: true,
    });
    expect(sourceList).toEqual([
      {
        url: 'https://example.com/nota',
        title: 'La nota',
        text: 'texto completo de la página',
      },
      {
        url: 'https://example.com/sin-raw',
        title: 'Sin raw',
        text: 'solo el snippet',
      },
    ]);
  });

  it('drops results with relative redirect urls instead of failing the batch', async () => {
    const { fetchImplementation } = createCapturingFetchMock({
      results: [
        {
          url: '/goto?url=CAESYAHuR6pN0iq',
          title: 'Redirect raro',
          content: 'snippet',
          raw_content: null,
        },
        {
          url: 'https://example.com/ok',
          title: 'Válida',
          content: 'snippet útil',
          raw_content: null,
        },
      ],
    });

    const sourceList = await searchWebSourcesWithTavily({
      tavilyApiKey: 'tvly-key',
      query: 'algo',
      fetchImplementation,
    });

    expect(sourceList).toEqual([
      { url: 'https://example.com/ok', title: 'Válida', text: 'snippet útil' },
    ]);
  });

  it('caps oversized page text so synthesis prompts stay bounded', async () => {
    const { fetchImplementation } = createCapturingFetchMock({
      results: [
        {
          url: 'https://example.com/larga',
          title: 'Página larga',
          content: 'snippet',
          raw_content: 'x'.repeat(20000),
        },
      ],
    });

    const sourceList = await searchWebSourcesWithTavily({
      tavilyApiKey: 'tvly-key',
      query: 'algo',
      fetchImplementation,
    });

    expect(sourceList[0].text.length).toBe(8000);
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock({}, 401);
    await expect(
      searchWebSourcesWithTavily({
        tavilyApiKey: 'tvly-bad',
        query: 'algo',
        fetchImplementation,
      }),
    ).rejects.toThrow('Búsqueda web falló con status 401');
  });
});
