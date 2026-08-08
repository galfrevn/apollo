import { describe, expect, it } from 'bun:test';

import {
  DEVICE_MIC_PCM_SAMPLE_RATE_HZ,
  isWavBuffer,
  sliceAudioBufferIntoChunkList,
  TTS_STREAM_CHUNK_BYTE_LENGTH,
  wrapPcmAsWavBuffer,
} from '@/voice/wav';

function buildPcmBuffer(byteLength: number): ArrayBuffer {
  const pcmBuffer = new ArrayBuffer(byteLength);
  new Uint8Array(pcmBuffer).fill(7);
  return pcmBuffer;
}

function readAsciiTag(view: DataView, byteOffset: number, length: number): string {
  let tag = '';
  for (let index = 0; index < length; index += 1) {
    tag += String.fromCharCode(view.getUint8(byteOffset + index));
  }
  return tag;
}

describe('wrapPcmAsWavBuffer', () => {
  it('prefixes a 44 byte RIFF header describing the device mic defaults', () => {
    const wavBuffer = wrapPcmAsWavBuffer({ pcmBuffer: buildPcmBuffer(160) });
    const view = new DataView(wavBuffer);

    expect(wavBuffer.byteLength).toBe(44 + 160);
    expect(readAsciiTag(view, 0, 4)).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(36 + 160);
    expect(readAsciiTag(view, 8, 4)).toBe('WAVE');
    expect(readAsciiTag(view, 12, 4)).toBe('fmt ');
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1);
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(DEVICE_MIC_PCM_SAMPLE_RATE_HZ);
    expect(view.getUint32(28, true)).toBe(DEVICE_MIC_PCM_SAMPLE_RATE_HZ * 2);
    expect(view.getUint16(32, true)).toBe(2);
    expect(view.getUint16(34, true)).toBe(16);
    expect(readAsciiTag(view, 36, 4)).toBe('data');
    expect(view.getUint32(40, true)).toBe(160);
  });

  it('copies the pcm payload after the header untouched', () => {
    const wavBuffer = wrapPcmAsWavBuffer({ pcmBuffer: buildPcmBuffer(8) });
    expect(new Uint8Array(wavBuffer, 44)).toEqual(
      new Uint8Array([7, 7, 7, 7, 7, 7, 7, 7]),
    );
  });

  it('honours explicit sample rate and channel count', () => {
    const wavBuffer = wrapPcmAsWavBuffer({
      pcmBuffer: buildPcmBuffer(64),
      sampleRateHz: 24000,
      channelCount: 2,
    });
    const view = new DataView(wavBuffer);

    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(24000);
    expect(view.getUint16(32, true)).toBe(4);
    expect(view.getUint32(28, true)).toBe(24000 * 4);
  });

  it('leaves an already wrapped buffer alone', () => {
    const wavBuffer = wrapPcmAsWavBuffer({ pcmBuffer: buildPcmBuffer(32) });
    expect(wrapPcmAsWavBuffer({ pcmBuffer: wavBuffer })).toBe(wavBuffer);
  });

  it('handles an empty utterance without producing a broken header', () => {
    const wavBuffer = wrapPcmAsWavBuffer({ pcmBuffer: new ArrayBuffer(0) });
    const view = new DataView(wavBuffer);

    expect(wavBuffer.byteLength).toBe(44);
    expect(view.getUint32(40, true)).toBe(0);
  });
});

describe('sliceAudioBufferIntoChunkList', () => {
  it('splits on the default chunk size, keeping a short tail', () => {
    const chunkList = sliceAudioBufferIntoChunkList(
      buildPcmBuffer(TTS_STREAM_CHUNK_BYTE_LENGTH * 2 + 100),
    );

    expect(chunkList).toHaveLength(3);
    expect(chunkList[0].byteLength).toBe(TTS_STREAM_CHUNK_BYTE_LENGTH);
    expect(chunkList[1].byteLength).toBe(TTS_STREAM_CHUNK_BYTE_LENGTH);
    expect(chunkList[2].byteLength).toBe(100);
  });

  it('preserves the total byte length announced in tts_start', () => {
    const audioBuffer = buildPcmBuffer(5000);
    const totalByteLength = sliceAudioBufferIntoChunkList(audioBuffer, 512).reduce(
      (sum, chunk) => sum + chunk.byteLength,
      0,
    );

    expect(totalByteLength).toBe(audioBuffer.byteLength);
  });

  it('returns a single chunk when the audio fits', () => {
    expect(sliceAudioBufferIntoChunkList(buildPcmBuffer(64), 512)).toHaveLength(1);
  });

  it('returns nothing for empty audio', () => {
    expect(sliceAudioBufferIntoChunkList(new ArrayBuffer(0))).toHaveLength(0);
  });

  it('rejects a non-positive chunk size instead of looping forever', () => {
    expect(() => sliceAudioBufferIntoChunkList(buildPcmBuffer(16), 0)).toThrow();
  });
});

describe('isWavBuffer', () => {
  it('rejects buffers shorter than a header', () => {
    expect(isWavBuffer(new ArrayBuffer(10))).toBe(false);
  });

  it('rejects raw pcm', () => {
    expect(isWavBuffer(buildPcmBuffer(128))).toBe(false);
  });

  it('accepts a wrapped buffer', () => {
    expect(isWavBuffer(wrapPcmAsWavBuffer({ pcmBuffer: buildPcmBuffer(16) }))).toBe(true);
  });
});
