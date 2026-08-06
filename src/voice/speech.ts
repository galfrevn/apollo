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
