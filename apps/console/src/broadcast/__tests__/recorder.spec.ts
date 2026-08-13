import { describe, expect, it } from 'bun:test';

import {
  computeRecordingDurationSeconds,
  convertFloat32ToInt16Pcm,
  encodePcmToBase64ChunkList,
  wrapPcmInWavHeader,
} from '@/broadcast/recorder';

describe('convertFloat32ToInt16Pcm', () => {
  it('scales and clamps float samples into signed sixteen bit', () => {
    const pcmSampleList = convertFloat32ToInt16Pcm(
      new Float32Array([0, 1, -1, 0.5, 2, -2]),
    );
    expect(Array.from(pcmSampleList)).toEqual([
      0, 32_767, -32_767, 16_384, 32_767, -32_767,
    ]);
  });

  it('stores samples little-endian', () => {
    const pcmSampleList = convertFloat32ToInt16Pcm(new Float32Array([1]));
    const pcmBytes = new Uint8Array(pcmSampleList.buffer);
    expect(Array.from(pcmBytes)).toEqual([0xff, 0x7f]);
  });
});

describe('encodePcmToBase64ChunkList', () => {
  it('splits into chunks and round-trips through base64', () => {
    const sourceBytes = new Uint8Array(10);
    for (let byteIndex = 0; byteIndex < sourceBytes.length; byteIndex += 1) {
      sourceBytes[byteIndex] = byteIndex;
    }
    const base64ChunkList = encodePcmToBase64ChunkList(sourceBytes, 4);
    expect(base64ChunkList).toHaveLength(3);
    const decodedBytes = base64ChunkList.flatMap((base64Chunk) =>
      Array.from(atob(base64Chunk), (character) => character.charCodeAt(0)),
    );
    expect(decodedBytes).toEqual(Array.from(sourceBytes));
  });

  it('computes the chunk count the upload begin call announces', () => {
    const thirtySecondByteLength = 1_440_000;
    const base64ChunkList = encodePcmToBase64ChunkList(
      new Uint8Array(thirtySecondByteLength),
    );
    expect(base64ChunkList).toHaveLength(8);
  });
});

describe('computeRecordingDurationSeconds', () => {
  it('derives seconds from the wire byte rate', () => {
    expect(computeRecordingDurationSeconds(48_000)).toBe(1);
    expect(computeRecordingDurationSeconds(1_440_000)).toBe(30);
  });
});

describe('wrapPcmInWavHeader', () => {
  it('writes a canonical forty-four byte mono header', async () => {
    const pcmBytes = new Uint8Array([1, 2, 3, 4]);
    const wavBlob = wrapPcmInWavHeader(pcmBytes);
    const wavBytes = new Uint8Array(await wavBlob.arrayBuffer());
    const headerView = new DataView(wavBytes.buffer);
    expect(wavBytes.length).toBe(48);
    expect(String.fromCharCode(...wavBytes.subarray(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wavBytes.subarray(8, 12))).toBe('WAVE');
    expect(headerView.getUint32(24, true)).toBe(24_000);
    expect(headerView.getUint16(22, true)).toBe(1);
    expect(headerView.getUint16(34, true)).toBe(16);
    expect(headerView.getUint32(40, true)).toBe(4);
    expect(Array.from(wavBytes.subarray(44))).toEqual([1, 2, 3, 4]);
  });
});
