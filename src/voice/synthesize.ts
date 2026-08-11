import { resolveApolloConfiguration } from '@/configuration/resolve';
import { synthesizeSpeechWithElevenLabs } from '@/voice/elevenlabs';
import { synthesizeSpeechThroughCache } from '@/voice/ttscache';

// The one production speech path: every caller gets the R2 cache, so a repeated
// utterance never costs ElevenLabs credits twice.
export async function synthesizeApolloSpeech(input: {
  readonly environment: Env;
  readonly text: string;
  readonly voiceId: string;
}): Promise<ArrayBuffer> {
  const { models } = resolveApolloConfiguration(input.environment);
  return synthesizeSpeechThroughCache({
    mediaBucket: input.environment.MEDIA,
    text: input.text,
    voiceId: input.voiceId,
    modelId: models.speech,
    synthesize: () =>
      synthesizeSpeechWithElevenLabs({
        text: input.text,
        voiceId: input.voiceId,
        elevenLabsApiKey: input.environment.ELEVENLABS_API_KEY,
        modelId: models.speech,
      }),
  });
}
