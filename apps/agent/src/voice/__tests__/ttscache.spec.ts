import { describe, expect, it } from 'bun:test';

import { buildTtsCacheObjectKey, synthesizeSpeechThroughCache } from '@/voice/ttscache';

function buildArrayBuffer(byteList: readonly number[]): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(byteList.length);
  new Uint8Array(arrayBuffer).set(byteList);
  return arrayBuffer;
}

function createFakeMediaBucket(): {
  readonly bucket: R2Bucket;
  readonly storedKeyList: string[];
  readonly store: Map<string, ArrayBuffer>;
} {
  const store = new Map<string, ArrayBuffer>();
  const storedKeyList: string[] = [];
  const bucket = {
    get: async (key: string) => {
      const stored = store.get(key);
      if (stored === undefined) {
        return null;
      }
      return { arrayBuffer: async () => stored };
    },
    put: async (key: string, body: ArrayBuffer) => {
      store.set(key, body);
      storedKeyList.push(key);
      return {};
    },
  } as unknown as R2Bucket;
  return { bucket, storedKeyList, store };
}

describe('synthesizeSpeechThroughCache', () => {
  it('synthesizes and stores on a miss, then serves the hit without synthesizing', async () => {
    const { bucket, storedKeyList } = createFakeMediaBucket();
    let synthesizeCallCount = 0;
    const synthesize = async (): Promise<ArrayBuffer> => {
      synthesizeCallCount += 1;
      return buildArrayBuffer([1, 2, 3]);
    };

    const firstAudio = await synthesizeSpeechThroughCache({
      mediaBucket: bucket,
      text: 'Hola, ¿cómo va?',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize,
    });
    const secondAudio = await synthesizeSpeechThroughCache({
      mediaBucket: bucket,
      text: 'Hola, ¿cómo va?',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize,
    });

    expect(synthesizeCallCount).toBe(1);
    expect(new Uint8Array(firstAudio)).toEqual(new Uint8Array([1, 2, 3]));
    expect(new Uint8Array(secondAudio)).toEqual(new Uint8Array([1, 2, 3]));
    expect(storedKeyList).toHaveLength(1);
    expect(storedKeyList[0]).toStartWith('tts-cache/');
  });

  it('keys by voice and model so a change never plays stale audio', async () => {
    const baseInput = { text: 'hola', voiceId: 'voz-1', modelId: 'modelo-1' };
    const sameKey = await buildTtsCacheObjectKey(baseInput);
    expect(await buildTtsCacheObjectKey({ ...baseInput })).toBe(sameKey);
    expect(await buildTtsCacheObjectKey({ ...baseInput, voiceId: 'voz-2' })).not.toBe(
      sameKey,
    );
    expect(await buildTtsCacheObjectKey({ ...baseInput, modelId: 'modelo-2' })).not.toBe(
      sameKey,
    );
    expect(await buildTtsCacheObjectKey({ ...baseInput, text: 'chau' })).not.toBe(
      sameKey,
    );
  });

  it('degrades to direct synthesis when the cache read fails', async () => {
    const bucket = {
      get: async () => {
        throw new Error('R2 caído');
      },
      put: async () => {
        throw new Error('R2 caído');
      },
    } as unknown as R2Bucket;

    const audioBuffer = await synthesizeSpeechThroughCache({
      mediaBucket: bucket,
      text: 'hola',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize: async () => buildArrayBuffer([9]),
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([9]));
  });

  it('still returns audio when only the cache write fails', async () => {
    const bucket = {
      get: async () => null,
      put: async () => {
        throw new Error('R2 sin espacio');
      },
    } as unknown as R2Bucket;

    const audioBuffer = await synthesizeSpeechThroughCache({
      mediaBucket: bucket,
      text: 'hola',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize: async () => buildArrayBuffer([7, 8]),
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([7, 8]));
  });
});
