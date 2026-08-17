import type { BlobStore } from '@/platform/blob';
import { synthesizeSpeechWithElevenLabs } from '@/voice/elevenlabs';
import { synthesizeSpeechThroughCache } from '@/voice/ttscache';

// The one production speech path: every caller gets the blob cache, so a
// repeated utterance never costs ElevenLabs credits twice.
export async function synthesizeApolloSpeech(input: {
  readonly environment: Env;
  readonly mediaBlobStore: BlobStore;
  readonly text: string;
  readonly voiceId: string;
}): Promise<ArrayBuffer> {
  return synthesizeSpeechThroughCache({
    mediaBlobStore: input.mediaBlobStore,
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
