import { fetchPageText } from '@/search/fetch';
import {
  dedupeWebPageUrlList,
  searchWebPages,
  type DiscoveredWebPage,
} from '@/search/web';

export type FetchedWebSource = {
  readonly url: string;
  readonly title: string;
  readonly text: string;
};

export async function collectFetchedSourceList(input: {
  readonly webSearch: Pick<Env['WEBSEARCH'], 'search'>;
  readonly queryList: readonly string[];
  readonly maxPages: number;
  readonly resultsPerQuery?: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<readonly FetchedWebSource[]> {
  const discoveredPageList: DiscoveredWebPage[] = [];
  for (const query of input.queryList) {
    const pageList = await searchWebPages({
      webSearch: input.webSearch,
      query,
      limit: input.resultsPerQuery ?? 5,
    });
    discoveredPageList.push(...pageList);
  }

  const uniquePageList = dedupeWebPageUrlList(
    discoveredPageList,
    input.maxPages,
  );
  const fetchedSourceList: FetchedWebSource[] = [];

  for (const page of uniquePageList) {
    const fetchResult = await fetchPageText({
      pageUrl: page.url,
      fetchImplementation: input.fetchImplementation,
    });
    if (!fetchResult.ok) {
      continue;
    }
    fetchedSourceList.push({
      url: page.url,
      title: page.title,
      text: fetchResult.text,
    });
  }

  return fetchedSourceList;
}
