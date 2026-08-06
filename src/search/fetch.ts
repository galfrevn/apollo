import { extractPlainTextFromHtml } from '@/search/extract';

export const DEFAULT_PAGE_FETCH_MAX_BYTES = 200_000;
export const DEFAULT_PAGE_TEXT_MAX_CHARACTERS = 4000;

export async function fetchPageText(input: {
  readonly pageUrl: string;
  readonly maxBytes?: number;
  readonly maxTextCharacters?: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly reason: string }
> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const maxBytes = input.maxBytes ?? DEFAULT_PAGE_FETCH_MAX_BYTES;
  const maxTextCharacters =
    input.maxTextCharacters ?? DEFAULT_PAGE_TEXT_MAX_CHARACTERS;

  try {
    const response = await fetchImplementation(input.pageUrl, {
      redirect: 'follow',
      headers: { Accept: 'text/html,application/xhtml+xml,text/plain' },
    });
    if (!response.ok) {
      return { ok: false, reason: `HTTP ${response.status}` };
    }

    const arrayBuffer = await response.arrayBuffer();
    const truncatedBuffer =
      arrayBuffer.byteLength > maxBytes
        ? arrayBuffer.slice(0, maxBytes)
        : arrayBuffer;
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const rawBody = decoder.decode(truncatedBuffer);
    const contentType = response.headers.get('content-type') ?? '';
    const plainText =
      contentType.includes('text/html') || rawBody.includes('<html')
        ? extractPlainTextFromHtml(rawBody)
        : rawBody.replace(/\s+/g, ' ').trim();

    if (plainText.length === 0) {
      return { ok: false, reason: 'empty body' };
    }

    return {
      ok: true,
      text: plainText.slice(0, maxTextCharacters),
    };
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}
