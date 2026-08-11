const OPENROUTER_CHAT_COMPLETIONS_URL = 'https://openrouter.ai/api/v1/chat/completions';
export const CODING_PROXY_PATH_PREFIX = '/coding-llm/v1';
export const CODING_PROXY_TOKEN_TTL_MILLISECONDS = 6 * 60 * 60 * 1000;

// The token is signed with the OpenRouter key itself: the worker already holds
// it, nothing new to provision, and rotating the key revokes every token that
// ever reached a sandbox.
async function computeTokenSignature(
  openRouterApiKey: string,
  payloadText: string,
): Promise<string> {
  const signingKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(openRouterApiKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign(
    'HMAC',
    signingKey,
    new TextEncoder().encode(payloadText),
  );
  return [...new Uint8Array(signatureBytes)]
    .map((byteValue) => byteValue.toString(16).padStart(2, '0'))
    .join('');
}

export async function mintCodingProxyToken(input: {
  readonly instanceId: string;
  readonly openRouterApiKey: string;
  readonly nowMilliseconds: number;
}): Promise<string> {
  const expiresAtMilliseconds =
    input.nowMilliseconds + CODING_PROXY_TOKEN_TTL_MILLISECONDS;
  const payloadText = `${input.instanceId}.${expiresAtMilliseconds}`;
  const signature = await computeTokenSignature(input.openRouterApiKey, payloadText);
  return `${payloadText}.${signature}`;
}

export async function verifyCodingProxyToken(input: {
  readonly token: string;
  readonly openRouterApiKey: string;
  readonly nowMilliseconds: number;
}): Promise<boolean> {
  const lastSeparatorIndex = input.token.lastIndexOf('.');
  if (lastSeparatorIndex <= 0) {
    return false;
  }
  const payloadText = input.token.slice(0, lastSeparatorIndex);
  const presentedSignature = input.token.slice(lastSeparatorIndex + 1);
  const expiresAtMilliseconds = Number(
    payloadText.slice(payloadText.lastIndexOf('.') + 1),
  );
  if (!Number.isFinite(expiresAtMilliseconds)) {
    return false;
  }
  if (input.nowMilliseconds > expiresAtMilliseconds) {
    return false;
  }
  const expectedSignature = await computeTokenSignature(
    input.openRouterApiKey,
    payloadText,
  );
  if (presentedSignature.length !== expectedSignature.length) {
    return false;
  }
  let differenceBits = 0;
  for (
    let characterIndex = 0;
    characterIndex < expectedSignature.length;
    characterIndex += 1
  ) {
    differenceBits |=
      presentedSignature.charCodeAt(characterIndex) ^
      expectedSignature.charCodeAt(characterIndex);
  }
  return differenceBits === 0;
}

// OpenAI-compatible passthrough for the opencode process inside the sandbox:
// the real OpenRouter key never leaves the worker, and the sandbox only ever
// sees a short-lived token this route can refuse.
export async function handleCodingLlmProxyRequest(
  request: Request,
  requestUrl: URL,
  environment: Env,
  fetchImplementation: typeof fetch = globalThis.fetch,
): Promise<Response> {
  if (
    request.method !== 'POST' ||
    requestUrl.pathname !== `${CODING_PROXY_PATH_PREFIX}/chat/completions`
  ) {
    return new Response('Not found', { status: 404 });
  }
  const authorizationHeader = request.headers.get('authorization') ?? '';
  const presentedToken = authorizationHeader.replace(/^Bearer\s+/i, '');
  const isTokenValid = await verifyCodingProxyToken({
    token: presentedToken,
    openRouterApiKey: environment.OPENROUTER_API_KEY,
    nowMilliseconds: Date.now(),
  });
  if (!isTokenValid) {
    return new Response('Unauthorized', { status: 401 });
  }

  const requestBodyText = await request.text();
  let requestedModel: unknown;
  try {
    requestedModel = (JSON.parse(requestBodyText) as { model?: unknown }).model;
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  if (requestedModel !== environment.OPENROUTER_CODING_MODEL) {
    return new Response('Model not allowed', { status: 403 });
  }

  return fetchImplementation(OPENROUTER_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${environment.OPENROUTER_API_KEY}`,
      'content-type': 'application/json',
    },
    body: requestBodyText,
  });
}
