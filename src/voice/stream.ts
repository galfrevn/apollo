import { sliceAudioBufferIntoChunkList, TTS_STREAM_CHUNK_BYTE_LENGTH } from '@/voice/wav';

// The device buffers a bounded number of decode packets and silently drops the
// overflow, so a reply pushed at link speed loses everything past the buffer.
// Sending at roughly playback pace keeps the device a fixed distance ahead
// instead: enough to absorb jitter, never enough to overflow.
export const TTS_STREAM_PREBUFFER_MILLISECONDS = 2000;

// Stay slightly ahead of real time so the device never starves mid-sentence.
const TTS_STREAM_PACE_FACTOR = 0.85;

// Ceiling on how much unplayed audio the device is asked to hold. The firmware
// queues ~6.8 s of frames (40 packets × ~170 ms) and silently drops overflow;
// at 0.85 pace the backlog grows ~150 ms per spoken second past the prebuffer,
// so replies longer than ~30 s used to cross the limit and clip near the end.
// Modeled backlog only counts waited time (not send/network time), so the real
// backlog is at or below this.
export const TTS_STREAM_MAX_BACKLOG_MILLISECONDS = 4000;

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

export type PlaybackAckSnapshot = {
  readonly playedMilliseconds: number;
  readonly receivedAtMilliseconds: number;
};

// Acks arrive about once a second; between them the estimate assumes playback
// kept running, capped at what was delivered so a stale ack can never claim
// more was played than was sent.
function estimatePlayedMilliseconds(
  ack: PlaybackAckSnapshot,
  deliveredMilliseconds: number,
  nowMilliseconds: number,
): number {
  const extrapolated =
    ack.playedMilliseconds + Math.max(0, nowMilliseconds - ack.receivedAtMilliseconds);
  return Math.min(deliveredMilliseconds, extrapolated);
}

export async function streamAudioChunksAtPlaybackPace(input: {
  readonly audioBuffer: ArrayBuffer;
  readonly sampleRateHz: number;
  readonly channelCount: number;
  readonly send: (chunk: ArrayBuffer) => void;
  readonly chunkByteLength?: number;
  readonly prebufferMilliseconds?: number;
  readonly wait?: (milliseconds: number) => Promise<void>;
  // Checked between chunks: pacing means the run is still in flight long after
  // it started, so an interruption has to be able to cut it short.
  readonly shouldStop?: () => boolean;
  // With acks the backlog is measured instead of modeled; without them the
  // open-loop pace factor stays in charge (firmware before 2.7.0 sends none).
  readonly getPlaybackAck?: () => PlaybackAckSnapshot | null;
  readonly now?: () => number;
}): Promise<number> {
  const chunkByteLength = input.chunkByteLength ?? TTS_STREAM_CHUNK_BYTE_LENGTH;
  const prebufferMilliseconds =
    input.prebufferMilliseconds ?? TTS_STREAM_PREBUFFER_MILLISECONDS;
  const wait = input.wait ?? waitWithTimeout;
  const now = input.now ?? Date.now;

  const chunkList = sliceAudioBufferIntoChunkList(input.audioBuffer, chunkByteLength);
  let unbufferedMilliseconds = prebufferMilliseconds;
  let deliveredMilliseconds = 0;
  let waitedMilliseconds = 0;
  let sentChunkCount = 0;

  for (const chunk of chunkList) {
    if (input.shouldStop?.() === true) {
      return sentChunkCount;
    }
    const chunkMilliseconds = computeChunkPlaybackMilliseconds({
      chunkByteLength: chunk.byteLength,
      sampleRateHz: input.sampleRateHz,
      channelCount: input.channelCount,
    });

    // Spend the prebuffer allowance first, then settle into playback pace —
    // but never let the accumulated lead exceed the backlog ceiling: pacing
    // slightly fast is open-loop, and on a long clip the excess compounds.
    if (unbufferedMilliseconds > 0) {
      unbufferedMilliseconds -= chunkMilliseconds;
    } else {
      const playbackAck = input.getPlaybackAck?.() ?? null;
      if (playbackAck !== null) {
        const backlogAfterSendMilliseconds =
          deliveredMilliseconds +
          chunkMilliseconds -
          estimatePlayedMilliseconds(playbackAck, deliveredMilliseconds, now());
        const waitMilliseconds =
          backlogAfterSendMilliseconds - TTS_STREAM_MAX_BACKLOG_MILLISECONDS;
        if (waitMilliseconds > 0) {
          await wait(waitMilliseconds);
        }
      } else {
        const backlogAfterSendMilliseconds =
          deliveredMilliseconds + chunkMilliseconds - waitedMilliseconds;
        const waitMilliseconds = Math.max(
          chunkMilliseconds * TTS_STREAM_PACE_FACTOR,
          backlogAfterSendMilliseconds - TTS_STREAM_MAX_BACKLOG_MILLISECONDS,
        );
        await wait(waitMilliseconds);
        waitedMilliseconds += waitMilliseconds;
      }
    }

    // Re-checked after the wait: an interruption most often lands while paused.
    if (input.shouldStop?.() === true) {
      return sentChunkCount;
    }

    input.send(chunk);
    deliveredMilliseconds += chunkMilliseconds;
    sentChunkCount += 1;
  }

  return sentChunkCount;
}
