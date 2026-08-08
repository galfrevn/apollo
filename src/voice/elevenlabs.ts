// The desk device plays TTS straight out of I2S, so the server asks ElevenLabs
// for raw PCM instead of mp3: no decoder has to run on the ESP32. pcm_24000 is
// headerless s16le mono, exactly what the firmware expects. 44.1kHz PCM would
// need the Pro tier; 24kHz is available on Starter.
export const TTS_PCM_SAMPLE_RATE_HZ = 24000;
export const TTS_PCM_CHANNEL_COUNT = 1;

export async function synthesizeSpeechWithElevenLabs(input: {
  readonly text: string;
  readonly voiceId: string;
  readonly elevenLabsApiKey: string;
  readonly modelId: string;
  readonly outputFormat?: 'pcm_24000' | 'mp3_44100_128';
  readonly fetchImplementation?: typeof fetch;
}): Promise<ArrayBuffer> {
  const fetchImplementation = input.fetchImplementation ?? globalThis.fetch;
  const outputFormat = input.outputFormat ?? 'pcm_24000';
  const response = await fetchImplementation(
    `https://api.elevenlabs.io/v1/text-to-speech/${input.voiceId}?output_format=${outputFormat}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': input.elevenLabsApiKey,
        'Content-Type': 'application/json',
      },
      // No language_code: eleven_multilingual_v2 rejects it, so the accent has
      // to live in the voice itself — hence a Rioplatense voice id.
      body: JSON.stringify({
        text: input.text,
        model_id: input.modelId,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`TTS falló con status ${response.status}`);
  }

  return response.arrayBuffer();
}
