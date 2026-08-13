import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { synthesizeSpeechWithElevenLabs } from '@/voice/elevenlabs';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

const capturedSynthesisRequestBodySchema = z
  .object({ text: z.string(), model_id: z.string() })
  .passthrough();

function parseCapturedSynthesisRequestBody(capturedCall: CapturedFetchCall) {
  return capturedSynthesisRequestBodySchema.parse(
    JSON.parse(String(capturedCall.init.body)),
  );
}

function createCapturingFetchMock(audioArrayBuffer: ArrayBuffer, status = 200) {
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
    }),
    callList,
  };
}

function buildArrayBuffer(byteList: readonly number[]): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(byteList.length);
  new Uint8Array(arrayBuffer).set(byteList);
  return arrayBuffer;
}

describe('synthesizeSpeechWithElevenLabs', () => {
  it('posts text and model to the voice endpoint, defaulting to pcm_24000', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock(
      buildArrayBuffer([1, 2, 3]),
    );

    const audioBuffer = await synthesizeSpeechWithElevenLabs({
      text: 'hola mundo',
      voiceId: 'voz-rioplatense',
      elevenLabsApiKey: 'key-123',
      modelId: 'eleven_multilingual_v2',
      fetchImplementation,
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([1, 2, 3]));
    expect(callList[0].url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/voz-rioplatense?output_format=pcm_24000',
    );
    expect(callList[0].init.headers).toMatchObject({ 'xi-api-key': 'key-123' });
    const requestBody = parseCapturedSynthesisRequestBody(callList[0]);
    expect(requestBody).toEqual({
      text: 'hola mundo',
      model_id: 'eleven_multilingual_v2',
    });
  });

  it('honors an explicit output format', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock(
      buildArrayBuffer([]),
    );

    await synthesizeSpeechWithElevenLabs({
      text: 'hola',
      voiceId: 'voz-rioplatense',
      elevenLabsApiKey: 'key-123',
      modelId: 'eleven_multilingual_v2',
      outputFormat: 'mp3_44100_128',
      fetchImplementation,
    });

    expect(callList[0].url).toContain('output_format=mp3_44100_128');
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock(buildArrayBuffer([]), 500);
    await expect(
      synthesizeSpeechWithElevenLabs({
        text: 'hola',
        voiceId: 'voz-rioplatense',
        elevenLabsApiKey: 'key-123',
        modelId: 'eleven_multilingual_v2',
        fetchImplementation,
      }),
    ).rejects.toThrow('TTS falló con status 500');
  });
});
