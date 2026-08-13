import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { transcribeAudioWithOpenRouter } from '@/voice/stt';

type CapturedFetchCall = {
  readonly url: string;
  readonly init: RequestInit;
};

type TranscriptionResponseFixture = {
  readonly text?: string | number;
};

const capturedTranscriptionRequestBodySchema = z.object({
  language: z.string(),
  input_audio: z.object({ data: z.string(), format: z.string() }),
});

function parseCapturedTranscriptionRequestBody(capturedCall: CapturedFetchCall) {
  return capturedTranscriptionRequestBodySchema.parse(
    JSON.parse(String(capturedCall.init.body)),
  );
}

function createCapturingFetchMock(
  responseBody: TranscriptionResponseFixture,
  status = 200,
) {
  const callList: CapturedFetchCall[] = [];
  const fetchHandler = async (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    callList.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify(responseBody), { status });
  };
  return {
    fetchImplementation: Object.assign(fetchHandler, {
      preconnect: () => {},
    }),
    callList,
  };
}

describe('transcribeAudioWithOpenRouter', () => {
  it('base64-encodes the audio and defaults language/format', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock({
      text: '  hola apolo  ',
    });

    const transcript = await transcribeAudioWithOpenRouter({
      audioBuffer: new Uint8Array([1, 2, 3]).buffer,
      openRouterApiKey: 'key-123',
      modelId: 'openai/whisper-large-v3',
      fetchImplementation,
    });

    expect(transcript).toBe('hola apolo');
    expect(callList[0].url).toBe('https://openrouter.ai/api/v1/audio/transcriptions');
    const requestBody = parseCapturedTranscriptionRequestBody(callList[0]);
    expect(requestBody.language).toBe('es');
    expect(requestBody.input_audio.format).toBe('wav');
    expect(requestBody.input_audio.data).toBe(btoa('\x01\x02\x03'));
  });

  it('honors an explicit language and audio format', async () => {
    const { fetchImplementation, callList } = createCapturingFetchMock({ text: 'hi' });

    await transcribeAudioWithOpenRouter({
      audioBuffer: new Uint8Array([9]).buffer,
      openRouterApiKey: 'key-123',
      modelId: 'openai/whisper-large-v3',
      languageCode: 'en',
      audioFormat: 'mp3',
      fetchImplementation,
    });

    const requestBody = parseCapturedTranscriptionRequestBody(callList[0]);
    expect(requestBody.language).toBe('en');
    expect(requestBody.input_audio.format).toBe('mp3');
  });

  it('throws on a non-ok response', async () => {
    const { fetchImplementation } = createCapturingFetchMock({}, 500);
    await expect(
      transcribeAudioWithOpenRouter({
        audioBuffer: new ArrayBuffer(0),
        openRouterApiKey: 'key-123',
        modelId: 'openai/whisper-large-v3',
        fetchImplementation,
      }),
    ).rejects.toThrow('STT falló con status 500');
  });

  it('throws when the transcript is empty', async () => {
    const { fetchImplementation } = createCapturingFetchMock({ text: '   ' });
    await expect(
      transcribeAudioWithOpenRouter({
        audioBuffer: new ArrayBuffer(0),
        openRouterApiKey: 'key-123',
        modelId: 'openai/whisper-large-v3',
        fetchImplementation,
      }),
    ).rejects.toThrow('STT devolvió texto vacío');
  });

  it('throws when the response does not match the expected schema', async () => {
    const { fetchImplementation } = createCapturingFetchMock({ text: 42 });
    await expect(
      transcribeAudioWithOpenRouter({
        audioBuffer: new ArrayBuffer(0),
        openRouterApiKey: 'key-123',
        modelId: 'openai/whisper-large-v3',
        fetchImplementation,
      }),
    ).rejects.toThrow();
  });
});
