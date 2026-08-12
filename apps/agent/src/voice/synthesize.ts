import { synthesizeSpeechWithElevenLabs } from '@/voice/elevenlabs';
import { synthesizeSpeechThroughCache } from '@/voice/ttscache';

// The one production speech path: every caller gets the R2 cache, so a repeated
// utterance never costs ElevenLabs credits twice.
export async function synthesizeApolloSpeech(input: {
  readonly environment: Env;
  readonly text: string;
  readonly voiceId: string;
}): Promise<ArrayBuffer> {
  return synthesizeSpeechThroughCache({
    mediaBucket: input.environment.MEDIA,
    text: input.text,
    voiceId: input.voiceId,
    modelId: input.environment.ELEVENLABS_TTS_MODEL,
    synthesize: () =>
      synthesizeSpeechWithElevenLabs({
        text: input.text,
        voiceId: input.voiceId,
        elevenLabsApiKey: input.environment.ELEVENLABS_API_KEY,
        modelId: input.environment.ELEVENLABS_TTS_MODEL,
      }),
  });
}
