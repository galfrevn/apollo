// ElevenLabs bills ~1 credit per character and Apollo repeats itself a lot
// (confirmations, reminder announcements, short acks), so identical utterances
// come back from R2. Keyed by voice+model+text: a voice or model change can
// never play stale audio.
export async function synthesizeSpeechThroughCache(input: {
  readonly mediaBucket: R2Bucket;
  readonly text: string;
  readonly voiceId: string;
  readonly modelId: string;
  readonly synthesize: () => Promise<ArrayBuffer>;
}): Promise<ArrayBuffer> {
  const cacheKey = await buildTtsCacheObjectKey({
    text: input.text,
    voiceId: input.voiceId,
    modelId: input.modelId,
  });

  // Cache trouble must never break speech: degrade to a direct synthesis.
  try {
    const cachedObject = await input.mediaBucket.get(cacheKey);
    if (cachedObject !== null) {
      return await cachedObject.arrayBuffer();
    }
  } catch {
    return input.synthesize();
  }

  const audioBuffer = await input.synthesize();
  try {
    await input.mediaBucket.put(cacheKey, audioBuffer, {
      httpMetadata: { contentType: 'application/octet-stream' },
    });
  } catch {
    // Stored nothing this time; the audio is still good.
  }
  return audioBuffer;
}

export async function buildTtsCacheObjectKey(input: {
  readonly text: string;
  readonly voiceId: string;
  readonly modelId: string;
}): Promise<string> {
  const digestInput = new TextEncoder().encode(
    `${input.voiceId}\n${input.modelId}\n${input.text}`,
  );
  const digest = await crypto.subtle.digest('SHA-256', digestInput);
  const hexDigest = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `tts-cache/${hexDigest}.pcm`;
}
