import { describe, expect, it } from 'bun:test';

import {
  computeChunkPlaybackMilliseconds,
  streamAudioChunksAtPlaybackPace,
  TTS_STREAM_MAX_BACKLOG_MILLISECONDS,
  TTS_STREAM_PREBUFFER_MILLISECONDS,
} from '@/voice/stream';

function buildAudioBuffer(byteLength: number): ArrayBuffer {
  return new ArrayBuffer(byteLength);
}

function createRecordingSink(): {
  readonly send: (chunk: ArrayBuffer) => void;
  readonly wait: (milliseconds: number) => Promise<void>;
  readonly sentByteLengthList: number[];
  readonly waitMillisecondsList: number[];
} {
  const sentByteLengthList: number[] = [];
  const waitMillisecondsList: number[] = [];
  return {
    send: (chunk) => {
      sentByteLengthList.push(chunk.byteLength);
    },
    wait: async (milliseconds) => {
      waitMillisecondsList.push(milliseconds);
    },
    sentByteLengthList,
    waitMillisecondsList,
  };
}

describe('computeChunkPlaybackMilliseconds', () => {
  it('converts 24 kHz mono 16-bit bytes to duration', () => {
    expect(
      computeChunkPlaybackMilliseconds({
        chunkByteLength: 48000,
        sampleRateHz: 24000,
        channelCount: 1,
      }),
    ).toBeCloseTo(1000, 5);
  });

  it('halves the duration when a second channel doubles the byte rate', () => {
    expect(
      computeChunkPlaybackMilliseconds({
        chunkByteLength: 48000,
        sampleRateHz: 24000,
        channelCount: 2,
      }),
    ).toBeCloseTo(500, 5);
  });

  it('rejects a format with no byte rate rather than dividing by zero', () => {
    expect(() =>
      computeChunkPlaybackMilliseconds({
        chunkByteLength: 1024,
        sampleRateHz: 0,
        channelCount: 1,
      }),
    ).toThrow();
  });
});

describe('streamAudioChunksAtPlaybackPace', () => {
  it('sends every byte exactly once, in order', async () => {
    const sink = createRecordingSink();
    const audioBuffer = buildAudioBuffer(8192 * 3 + 500);

    const chunkCount = await streamAudioChunksAtPlaybackPace({
      audioBuffer,
      sampleRateHz: 24000,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
    });

    expect(chunkCount).toBe(4);
    expect(sink.sentByteLengthList).toEqual([8192, 8192, 8192, 500]);
    expect(sink.sentByteLengthList.reduce((sum, length) => sum + length, 0)).toBe(
      audioBuffer.byteLength,
    );
  });

  it('does not wait at all while inside the prebuffer allowance', async () => {
    const sink = createRecordingSink();
    // Two seconds of prebuffer at 48 KB/s is ~96000 bytes, so 48000 fits.
    await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(48000),
      sampleRateHz: 24000,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
    });

    expect(sink.waitMillisecondsList).toEqual([]);
  });

  it('paces the tail of a reply that outlasts the prebuffer', async () => {
    const sink = createRecordingSink();
    // Ten seconds of audio: well past the prebuffer, so most chunks wait.
    await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(48000 * 10),
      sampleRateHz: 24000,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
    });

    expect(sink.waitMillisecondsList.length).toBeGreaterThan(0);
    const totalWaitMilliseconds = sink.waitMillisecondsList.reduce(
      (sum, milliseconds) => sum + milliseconds,
      0,
    );
    // Paced below real time on purpose: the device must stay ahead, never starve.
    expect(totalWaitMilliseconds).toBeLessThan(10000);
    expect(totalWaitMilliseconds).toBeGreaterThan(5000);
  });

  it('stops sending as soon as an interruption is signalled', async () => {
    const sink = createRecordingSink();
    let sentCount = 0;
    const send = (chunk: ArrayBuffer): void => {
      sentCount += 1;
      sink.send(chunk);
    };

    const chunkCount = await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(48000 * 20),
      sampleRateHz: 24000,
      channelCount: 1,
      send,
      wait: sink.wait,
      shouldStop: () => sentCount >= 3,
    });

    expect(chunkCount).toBe(3);
    expect(sink.sentByteLengthList).toHaveLength(3);
  });

  it('reports how much it sent so an interrupted run is not mistaken for a full one', async () => {
    const sink = createRecordingSink();
    const fullRun = await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(8192 * 4),
      sampleRateHz: 24000,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
      shouldStop: () => false,
    });

    expect(fullRun).toBe(4);
  });

  it('keeps the device from ever holding more than the prebuffer plus one chunk', async () => {
    const sink = createRecordingSink();
    const sampleRateHz = 24000;
    await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(48000 * 20),
      sampleRateHz,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
    });

    // Reconstruct the backlog the device would carry: audio handed over minus
    // audio played while we waited.
    const chunkMilliseconds = computeChunkPlaybackMilliseconds({
      chunkByteLength: 8192,
      sampleRateHz,
      channelCount: 1,
    });
    let deliveredMilliseconds = 0;
    let drainedMilliseconds = 0;
    let peakBacklogMilliseconds = 0;
    for (let index = 0; index < sink.sentByteLengthList.length; index += 1) {
      drainedMilliseconds += sink.waitMillisecondsList[index - 1] ?? 0;
      deliveredMilliseconds += chunkMilliseconds;
      peakBacklogMilliseconds = Math.max(
        peakBacklogMilliseconds,
        deliveredMilliseconds - drainedMilliseconds,
      );
    }

    // The device buffers ~6.8 s before it starts dropping packets.
    expect(peakBacklogMilliseconds).toBeLessThan(6000);
    expect(peakBacklogMilliseconds).toBeGreaterThan(
      TTS_STREAM_PREBUFFER_MILLISECONDS - 500,
    );
  });

  it('caps the backlog on a very long reply instead of growing it without bound', async () => {
    const sink = createRecordingSink();
    const sampleRateHz = 24000;
    // Two minutes of audio: at open-loop 0.85 pace the backlog would reach
    // ~2 s + 0.15 × 118 s ≈ 20 s, far past the device's ~6.8 s queue. An
    // exact multiple of the chunk size keeps the constant-chunk
    // reconstruction below faithful.
    await streamAudioChunksAtPlaybackPace({
      audioBuffer: buildAudioBuffer(8192 * 700),
      sampleRateHz,
      channelCount: 1,
      send: sink.send,
      wait: sink.wait,
    });

    const chunkMilliseconds = computeChunkPlaybackMilliseconds({
      chunkByteLength: 8192,
      sampleRateHz,
      channelCount: 1,
    });
    let deliveredMilliseconds = 0;
    let drainedMilliseconds = 0;
    let peakBacklogMilliseconds = 0;
    for (let index = 0; index < sink.sentByteLengthList.length; index += 1) {
      drainedMilliseconds += sink.waitMillisecondsList[index - 1] ?? 0;
      deliveredMilliseconds += chunkMilliseconds;
      peakBacklogMilliseconds = Math.max(
        peakBacklogMilliseconds,
        deliveredMilliseconds - drainedMilliseconds,
      );
    }

    expect(peakBacklogMilliseconds).toBeLessThanOrEqual(
      TTS_STREAM_MAX_BACKLOG_MILLISECONDS + 1,
    );
    // Still ahead of playback: the cap must not starve the device either.
    expect(peakBacklogMilliseconds).toBeGreaterThan(
      TTS_STREAM_PREBUFFER_MILLISECONDS - 500,
    );
  });
});
