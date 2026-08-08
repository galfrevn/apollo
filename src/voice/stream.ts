import { sliceAudioBufferIntoChunkList, TTS_STREAM_CHUNK_BYTE_LENGTH } from '@/voice/wav';

// The device buffers a bounded number of decode packets and silently drops the
// overflow, so a reply pushed at link speed loses everything past the buffer.
// Sending at roughly playback pace keeps the device a fixed distance ahead
// instead: enough to absorb jitter, never enough to overflow.
export const TTS_STREAM_PREBUFFER_MILLISECONDS = 2000;

// Stay slightly ahead of real time so the device never starves mid-sentence.
const TTS_STREAM_PACE_FACTOR = 0.85;

export function computeChunkPlaybackMilliseconds(input: {
  readonly chunkByteLength: number;
  readonly sampleRateHz: number;
  readonly channelCount: number;
  readonly bitsPerSample?: number;
}): number {
  const bitsPerSample = input.bitsPerSample ?? 16;
  const bytesPerSecond = input.sampleRateHz * input.channelCount * (bitsPerSample / 8);
  if (bytesPerSecond <= 0) {
    throw new Error('El formato de audio no puede tener un byte rate de cero');
  }
  return (input.chunkByteLength / bytesPerSecond) * 1000;
}

async function waitWithTimeout(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function streamAudioChunksAtPlaybackPace(input: {
  readonly audioBuffer: ArrayBuffer;
  readonly sampleRateHz: number;
  readonly channelCount: number;
  readonly send: (chunk: ArrayBuffer) => void;
  readonly chunkByteLength?: number;
  readonly prebufferMilliseconds?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
}): Promise<number> {
  const chunkByteLength = input.chunkByteLength ?? TTS_STREAM_CHUNK_BYTE_LENGTH;
  const prebufferMilliseconds =
    input.prebufferMilliseconds ?? TTS_STREAM_PREBUFFER_MILLISECONDS;
  const wait = input.wait ?? waitWithTimeout;

  const chunkList = sliceAudioBufferIntoChunkList(input.audioBuffer, chunkByteLength);
  let unbufferedMilliseconds = prebufferMilliseconds;

  for (const chunk of chunkList) {
    const chunkMilliseconds = computeChunkPlaybackMilliseconds({
      chunkByteLength: chunk.byteLength,
      sampleRateHz: input.sampleRateHz,
      channelCount: input.channelCount,
    });

    // Spend the prebuffer allowance first, then settle into playback pace.
    if (unbufferedMilliseconds > 0) {
      unbufferedMilliseconds -= chunkMilliseconds;
    } else {
      await wait(chunkMilliseconds * TTS_STREAM_PACE_FACTOR);
    }

    input.send(chunk);
  }

  return chunkList.length;
}
