import { describe, expect, it } from 'bun:test';

import { synthesizeSpeechWithOpenRouter } from '@/voice/speech';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

function createCapturingFetchMock(
  audioArrayBuffer: ArrayBuffer,
  status = 200,
): {
  readonly fetchImplementation: typeof fetch;
  readonly callList: CapturedFetchCall[];
} {
  const callList: CapturedFetchCall[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callList.push({ url: String(input), init: init ?? {} });
    return new Response(audioArrayBuffer, { status });
  };
  return {
    fetchImplementation: Object.assign(fetchHandler, {
      preconnect: () => {},
    }) as typeof fetch,
    callList,
  };
}

function buildArrayBuffer(byteList: readonly number[]): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(byteList.length);
  new Uint8Array(arrayBuffer).set(byteList);
  return arrayBuffer;
}

describe('synthesizeSpeechWithOpenRouter', () => {
  it('posts text, voice, and model, defaulting to mp3', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock(
      buildArrayBuffer([1, 2, 3]),
    );

    const audioBuffer = await synthesizeSpeechWithOpenRouter({
      text: 'hola mundo',
      voiceId: 'af_alloy',
      openRouterApiKey: 'key-123',
      modelId: 'hexgrad/kokoro-82m',
      fetchImplementation,
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(callList[0].url).toBe('https://openrouter.ai/api/v1/audio/speech');
    expect(callList[0].init.headers).toMatchObject({ Authorization: 'Bearer key-123' });
    const requestBody = JSON.parse(callList[0].init.body as string) as Record<
      string,
      unknown
    >;
    expect(requestBody).toMatchObject({
      model: 'hexgrad/kokoro-82m',
      input: 'hola mundo',
      voice: 'af_alloy',
      response_format: 'mp3',
    });
  });

  it('honors an explicit response format', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock(
      buildArrayBuffer([]),
    );

    await synthesizeSpeechWithOpenRouter({
      text: 'hola',
      voiceId: 'af_alloy',
      openRouterApiKey: 'key-123',
      modelId: 'hexgrad/kokoro-82m',
      responseFormat: 'pcm',
      fetchImplementation,
    });

    const requestBody = JSON.parse(callList[0].init.body as string) as {
      response_format: string;
    };
    expect(requestBody.response_format).toBe('pcm');
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock(buildArrayBuffer([]), 500);
    await expect(
      synthesizeSpeechWithOpenRouter({
        text: 'hola',
        voiceId: 'af_alloy',
        openRouterApiKey: 'key-123',
        modelId: 'hexgrad/kokoro-82m',
        fetchImplementation,
      }),
    ).rejects.toThrow('TTS falló con status 500');
  });
});
