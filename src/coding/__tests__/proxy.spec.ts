import { describe, expect, it } from 'bun:test';

import {
  handleCodingLlmProxyRequest,
  mintCodingProxyToken,
  verifyCodingProxyToken,
} from '@/coding/proxy';
import { createFakeApolloEnvironment } from '@/configuration/testing';

const OPENROUTER_API_KEY = 'sk-or-test-key';

describe('coding proxy tokens', () => {
  it('accepts a freshly minted token and rejects it after expiry', async () => {
    const token = await mintCodingProxyToken({
      instanceId: 'wf-1',
      openRouterApiKey: OPENROUTER_API_KEY,
      nowMilliseconds: 1_000,
    });

    expect(
      await verifyCodingProxyToken({
        token,
        openRouterApiKey: OPENROUTER_API_KEY,
        nowMilliseconds: 2_000,
      }),
    ).toBe(true);
    expect(
      await verifyCodingProxyToken({
        token,
        openRouterApiKey: OPENROUTER_API_KEY,
        nowMilliseconds: 1_000 + 7 * 60 * 60 * 1000,
      }),
    ).toBe(false);
  });

  it('rejects a tampered token and a token signed with another key', async () => {
    const token = await mintCodingProxyToken({
      instanceId: 'wf-1',
      openRouterApiKey: OPENROUTER_API_KEY,
      nowMilliseconds: 1_000,
    });

    expect(
      await verifyCodingProxyToken({
        token: token.replace('wf-1', 'wf-2'),
        openRouterApiKey: OPENROUTER_API_KEY,
        nowMilliseconds: 2_000,
      }),
    ).toBe(false);
    expect(
      await verifyCodingProxyToken({
        token,
        openRouterApiKey: 'sk-or-other-key',
        nowMilliseconds: 2_000,
      }),
    ).toBe(false);
    expect(
      await verifyCodingProxyToken({
        token: 'garbage',
        openRouterApiKey: OPENROUTER_API_KEY,
        nowMilliseconds: 2_000,
      }),
    ).toBe(false);
  });
});

describe('handleCodingLlmProxyRequest', () => {
  async function buildAuthorizedRequest(bodyObject: unknown): Promise<Request> {
    const token = await mintCodingProxyToken({
      instanceId: 'wf-1',
      openRouterApiKey: OPENROUTER_API_KEY,
      nowMilliseconds: Date.now(),
    });
    return new Request('https://apollo.example/coding-llm/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(bodyObject),
    });
  }

  const environment = createFakeApolloEnvironment({
    OPENROUTER_API_KEY,
  });

  it('forwards an authorized request to OpenRouter with the real key', async () => {
    let forwardedUrl = '';
    let forwardedAuthorization = '';
    let forwardedBody = '';
    const fakeFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      forwardedUrl = String(url);
      forwardedAuthorization = new Headers(init?.headers).get('authorization') ?? '';
      forwardedBody = String(init?.body);
      return new Response('{"ok":true}');
    }) as typeof fetch;

    const request = await buildAuthorizedRequest({
      model: 'moonshotai/kimi-k3',
      messages: [],
    });
    const response = await handleCodingLlmProxyRequest(
      request,
      new URL(request.url),
      environment,
      fakeFetch,
    );

    expect(response.status).toBe(200);
    expect(forwardedUrl).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(forwardedAuthorization).toBe(`Bearer ${OPENROUTER_API_KEY}`);
    expect(forwardedBody).toContain('moonshotai/kimi-k3');
  });

  it('rejects a missing token, a foreign model, and a stray path', async () => {
    const unauthorizedRequest = new Request(
      'https://apollo.example/coding-llm/v1/chat/completions',
      { method: 'POST', body: '{}' },
    );
    const unauthorizedResponse = await handleCodingLlmProxyRequest(
      unauthorizedRequest,
      new URL(unauthorizedRequest.url),
      environment,
    );
    expect(unauthorizedResponse.status).toBe(401);

    const foreignModelRequest = await buildAuthorizedRequest({
      model: 'openai/gpt-5',
      messages: [],
    });
    const foreignModelResponse = await handleCodingLlmProxyRequest(
      foreignModelRequest,
      new URL(foreignModelRequest.url),
      environment,
    );
    expect(foreignModelResponse.status).toBe(403);

    const strayPathRequest = new Request('https://apollo.example/coding-llm/v1/models', {
      method: 'POST',
      body: '{}',
    });
    const strayPathResponse = await handleCodingLlmProxyRequest(
      strayPathRequest,
      new URL(strayPathRequest.url),
      environment,
    );
    expect(strayPathResponse.status).toBe(404);
  });
});
