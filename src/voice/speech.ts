// The desk device plays TTS straight out of I2S, so the server asks OpenRouter
// for raw PCM instead of mp3: no decoder has to run on the ESP32.
export const OPENROUTER_TTS_PCM_SAMPLE_RATE_HZ = 24000;
export const OPENROUTER_TTS_PCM_CHANNEL_COUNT = 1;

export async function synthesizeSpeechWithOpenRouter(input: {
  readonly text: string;
  readonly voiceId: string;
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly responseFormat?: 'mp3' | 'pcm';
  readonly fetchImplementation?: typeof fetch;
}): Promise<ArrayBuffer> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const response = await fetchImplementation(
    'https://openrouter.ai/api/v1/audio/speech',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.openRouterApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.modelId,
        input: input.text,
        voice: input.voiceId,
        response_format: input.responseFormat ?? 'mp3',
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`TTS falló con status ${response.status}`);
  }

  return response.arrayBuffer();
}
