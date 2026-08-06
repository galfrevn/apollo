import { z } from 'zod';

export type DiscoveredWebPage = {
  readonly url: string;
  readonly title: string;
  readonly description: string;
};

const webSearchBindingResultSchema = z.object({
  items: z.array(
    z.object({
      url: z.string().url(),
      title: z.string(),
      description: z.string().optional(),
    }),
  ),
});

export async function searchWebPages(input: {
  readonly webSearch: Pick<Env['WEBSEARCH'], 'search'>;
  readonly query: string;
  readonly limit?: number;
}): Promise<readonly DiscoveredWebPage[]> {
  const rawResult = await input.webSearch.search({
    query: input.query,
    limit: input.limit,
  });
  const parsedResult = webSearchBindingResultSchema.parse(rawResult);
  return parsedResult.items.map((item) => ({
    url: item.url,
    title: item.title,
    description: item.description ?? '',
  }));
}

export function dedupeWebPageUrlList(
  pageList: readonly DiscoveredWebPage[],
  maxCount: number,
): readonly DiscoveredWebPage[] {
  const seenUrlSet = new Set<string>();
  const dedupedPageList: DiscoveredWebPage[] = [];
  for (const page of pageList) {
    if (seenUrlSet.has(page.url)) {
      continue;
    }
    seenUrlSet.add(page.url);
    dedupedPageList.push(page);
    if (dedupedPageList.length >= maxCount) {
      break;
    }
  }
  return dedupedPageList;
}
