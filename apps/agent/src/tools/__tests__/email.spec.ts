import { afterEach, describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { sendEmailTool } from '@/tools/email';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('sendEmailTool', () => {
  it('reports the configuration gap when the owner address is missing', async () => {
    const result = await sendEmailTool.handler(
      { subject: 'Hola', body: 'Probando' },
      {
        environment: createFakeApolloEnvironment({
          RESEND_API_KEY: 'resend-key',
          APOLLO_OWNER_EMAIL: undefined,
        }),
        nowMilliseconds: 0,
      },
    );

    expect(result.ok).toBe(false);
    expect(result.summary).toContain('APOLLO_OWNER_EMAIL');
  });

  it('delivers to the configured owner address and nowhere else', async () => {
    const capturedBodyList: unknown[] = [];
    const fetchHandler = async (
      _input: string | URL | Request,
      init?: RequestInit,
    ): Promise<Response> => {
      capturedBodyList.push(JSON.parse(String(init?.body)));
      return new Response('{}', { status: 200 });
    };
    globalThis.fetch = Object.assign(fetchHandler, { preconnect: () => {} });

    const result = await sendEmailTool.handler(
      { subject: 'Hola', body: 'Probando' },
      {
        environment: createFakeApolloEnvironment({
          RESEND_API_KEY: 'resend-key',
          APOLLO_OWNER_EMAIL: 'owner@example.com',
        }),
        nowMilliseconds: 0,
      },
    );

    expect(result.ok).toBe(true);
    expect(capturedBodyList).toHaveLength(1);
    expect(capturedBodyList[0]).toMatchObject({ to: ['owner@example.com'] });
  });
});
