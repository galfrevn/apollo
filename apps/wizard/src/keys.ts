import { z } from 'zod';

const KEY_VALIDATION_TIMEOUT_MILLISECONDS = 10_000;
export const MAXIMUM_VOICE_CHOICE_COUNT = 30;

export type KeyValidationResult =
  | { readonly isValid: true; readonly successDetail?: string }
  | { readonly isValid: false; readonly reason: string };

async function fetchWithTimeout(
  requestUrl: string,
  requestInit: RequestInit,
): Promise<Response> {
  return fetch(requestUrl, {
    ...requestInit,
    signal: AbortSignal.timeout(KEY_VALIDATION_TIMEOUT_MILLISECONDS),
  });
}

function describeHttpFailure(response: Response): string {
  return response.status === 401 || response.status === 403
    ? 'the key was rejected (unauthorized)'
    : `unexpected status ${response.status}`;
}

const openRouterKeyResponseSchema = z.object({
  data: z.object({
    usage: z.number().optional(),
    limit_remaining: z.number().nullable().optional(),
  }),
});

export function describeOpenRouterKeyStatus(rawResponse: unknown): string | undefined {
  const parsedResponse = openRouterKeyResponseSchema.safeParse(rawResponse);
  if (!parsedResponse.success) {
    return undefined;
  }
  const remainingCredit = parsedResponse.data.data.limit_remaining;
  if (typeof remainingCredit === 'number') {
    return `$${remainingCredit.toFixed(2)} credit remaining`;
  }
  const usedCredit = parsedResponse.data.data.usage;
  if (typeof usedCredit === 'number') {
    return `$${usedCredit.toFixed(2)} used so far`;
  }
  return undefined;
}

export async function validateOpenRouterApiKey(
  apiKey: string,
): Promise<KeyValidationResult> {
  try {
    const response = await fetchWithTimeout('https://openrouter.ai/api/v1/key', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return { isValid: false, reason: describeHttpFailure(response) };
    }
    const responseBody: unknown = await response.json().catch(() => undefined);
    return { isValid: true, successDetail: describeOpenRouterKeyStatus(responseBody) };
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : 'network error',
    };
  }
}

const elevenLabsVoicesResponseSchema = z.object({
  voices: z.array(
    z.object({
      voice_id: z.string().min(1),
      name: z.string().min(1),
      category: z.string().optional(),
      labels: z.record(z.string()).optional(),
    }),
  ),
});

export type VoiceChoice = {
  readonly voiceId: string;
  readonly displayLabel: string;
  readonly detailHint?: string;
};

export function mapVoicesResponseToChoiceList(
  rawResponse: unknown,
): readonly VoiceChoice[] {
  const parsedResponse = elevenLabsVoicesResponseSchema.parse(rawResponse);
  return parsedResponse.voices.slice(0, MAXIMUM_VOICE_CHOICE_COUNT).map((voice) => {
    const labelDetailList = [
      voice.labels?.accent,
      voice.labels?.language,
      voice.category,
    ].filter((detail): detail is string => detail !== undefined && detail.length > 0);
    return {
      voiceId: voice.voice_id,
      displayLabel: voice.name,
      ...(labelDetailList.length > 0 ? { detailHint: labelDetailList.join(', ') } : {}),
    };
  });
}

export async function listElevenLabsVoiceChoiceList(
  apiKey: string,
): Promise<readonly VoiceChoice[]> {
  const response = await fetchWithTimeout('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) {
    throw new Error(describeHttpFailure(response));
  }
  return mapVoicesResponseToChoiceList(await response.json());
}

export async function validateTavilyApiKey(apiKey: string): Promise<KeyValidationResult> {
  try {
    const response = await fetchWithTimeout('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: 'apollo starter key check', max_results: 1 }),
    });
    return response.ok
      ? { isValid: true }
      : { isValid: false, reason: describeHttpFailure(response) };
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : 'network error',
    };
  }
}

// Resend keys scoped to sending-only cannot list domains, so a rejection here
// is a warning, not a hard failure.
export async function validateResendApiKey(apiKey: string): Promise<KeyValidationResult> {
  try {
    const response = await fetchWithTimeout('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return response.ok
      ? { isValid: true }
      : { isValid: false, reason: describeHttpFailure(response) };
  } catch (error) {
    return {
      isValid: false,
      reason: error instanceof Error ? error.message : 'network error',
    };
  }
}
