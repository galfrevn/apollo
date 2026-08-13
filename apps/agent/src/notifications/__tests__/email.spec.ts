import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { sendEmailWithResend } from '@/notifications/email';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

type CapturingFetchMock = {
  readonly fetchImplementation: typeof fetch;
  readonly callList: CapturedFetchCall[];
};

const sentEmailPayloadSchema = z.object({
  to: z.array(z.string()),
  subject: z.string(),
  text: z.string(),
});

function createCapturingFetchMock(status = 200): CapturingFetchMock {
  const callList: CapturedFetchCall[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callList.push({ url: String(input), init: init ?? {} });
    return new Response('{}', { status });
  };
  return {
    fetchImplementation: Object.assign(fetchHandler, {
      preconnect: () => {},
    }),
    callList,
  };
}

describe('sendEmailWithResend', () => {
  it('posts the email to the owner address with bearer auth', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock();

    await sendEmailWithResend({
      resendApiKey: 're-key',
      toAddress: 'dueno@example.com',
      subject: 'Informe',
      textBody: 'contenido',
      fetchImplementation,
    });

    expect(callList[0].url).toBe('https://api.resend.com/emails');
    expect(callList[0].init.headers).toMatchObject({ Authorization: 'Bearer re-key' });
    const rawRequestBody: unknown = JSON.parse(z.string().parse(callList[0].init.body));
    const requestBody = sentEmailPayloadSchema.parse(rawRequestBody);
    expect(requestBody).toMatchObject({
      to: ['dueno@example.com'],
      subject: 'Informe',
      text: 'contenido',
    });
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock(422);
    await expect(
      sendEmailWithResend({
        resendApiKey: 're-bad',
        toAddress: 'dueno@example.com',
        subject: 'x',
        textBody: 'y',
        fetchImplementation,
      }),
    ).rejects.toThrow('Email falló con status 422');
  });
});
