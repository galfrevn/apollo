import { z } from 'zod';

export type TavilyWebSource = {
  readonly url: string;
  readonly title: string;
  readonly text: string;
};

// url is a plain string on purpose: the live API sometimes returns relative
// redirect urls ("/goto?url=..."), and a strict .url() would fail the whole
// batch — those rows get filtered out below instead.
const tavilySearchResponseSchema = z.object({
  results: z.array(
    z.object({
      url: z.string(),
      title: z.string(),
      content: z.string(),
      raw_content: z.string().nullable().optional(),
    }),
  ),
});

// Tavily replaced the Cloudflare Web Search binding (account_disabled on the
// free plan). Its results already include page content, so there is no
// follow-up fetch of every URL: one request, sources ready to synthesize.
export async function searchWebSourcesWithTavily(input: {
  readonly tavilyApiKey: string;
  readonly query: string;
  readonly maxResults?: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<readonly TavilyWebSource[]> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.tavilyApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: input.query,
      max_results: input.maxResults ?? 5,
      include_raw_content: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Búsqueda web falló con status ${response.status}`);
  }

  const payload = tavilySearchResponseSchema.parse(await response.json());
  return payload.results
    .filter((result) => result.url.startsWith('http'))
    .map((result) => ({
      url: result.url,
      title: result.title,
      // raw_content is the full page text; content is a relevance snippet.
      // Cap the raw text so a huge page does not blow up the synthesis prompt.
      text: (result.raw_content ?? result.content).slice(0, 8000),
    }));
}
