import { describe, expect, it } from 'bun:test';

import type { BlobStore } from '@/platform/blob';
import { buildTtsCacheObjectKey, synthesizeSpeechThroughCache } from '@/voice/ttscache';

function buildArrayBuffer(byteList: readonly number[]): ArrayBuffer {
  const arrayBuffer = new ArrayBuffer(byteList.length);
  new Uint8Array(arrayBuffer).set(byteList);
  return arrayBuffer;
}

const rejectCacheRead: BlobStore['get'] = async () => {
  throw new Error('Blob store caído');
};
const rejectCacheWrite: BlobStore['put'] = async () => {
  throw new Error('Blob store sin espacio');
};
const resolveCacheMiss: BlobStore['get'] = async () => null;
const resolveEmptyListing: BlobStore['list'] = async () => ({
  entryList: [],
  isTruncated: false,
});
const ignoreDelete: BlobStore['delete'] = async () => {};

function createFakeCacheBlobStore() {
  const store = new Map<string, ArrayBuffer>();
  const storedKeyList: string[] = [];
  const blobStore: BlobStore = {
    async get(objectKey) {
      const stored = store.get(objectKey);
      if (stored === undefined) {
        return null;
      }
      return {
        size: stored.byteLength,
        body: null,
        arrayBuffer: async () => stored,
        text: async () => new TextDecoder().decode(stored),
        json: async (): Promise<unknown> => JSON.parse(new TextDecoder().decode(stored)),
      };
    },
    async put(objectKey, content) {
      const contentBytes =
        content instanceof ArrayBuffer
          ? new Uint8Array(content)
          : content instanceof Uint8Array
            ? content
            : new TextEncoder().encode(content);
      const contentBuffer = new ArrayBuffer(contentBytes.byteLength);
      new Uint8Array(contentBuffer).set(contentBytes);
      store.set(objectKey, contentBuffer);
      storedKeyList.push(objectKey);
    },
    delete: ignoreDelete,
    list: resolveEmptyListing,
  };
  return { blobStore, storedKeyList, store };
}

describe('synthesizeSpeechThroughCache', () => {
  it('synthesizes and stores on a miss, then serves the hit without synthesizing', async () => {
    const { blobStore, storedKeyList } = createFakeCacheBlobStore();
    let synthesizeCallCount = 0;
    const synthesize = async (): Promise<ArrayBuffer> => {
      synthesizeCallCount += 1;
      return buildArrayBuffer([1, 2, 3]);
    };

    const firstAudio = await synthesizeSpeechThroughCache({
      mediaBlobStore: blobStore,
      text: 'Hola, ¿cómo va?',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize,
    });
    const secondAudio = await synthesizeSpeechThroughCache({
      mediaBlobStore: blobStore,
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
    const blobStore: BlobStore = {
      get: rejectCacheRead,
      put: rejectCacheWrite,
      delete: ignoreDelete,
      list: resolveEmptyListing,
    };

    const audioBuffer = await synthesizeSpeechThroughCache({
      mediaBlobStore: blobStore,
      text: 'hola',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize: async () => buildArrayBuffer([9]),
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([9]));
  });

  it('still returns audio when only the cache write fails', async () => {
    const blobStore: BlobStore = {
      get: resolveCacheMiss,
      put: rejectCacheWrite,
      delete: ignoreDelete,
      list: resolveEmptyListing,
    };

    const audioBuffer = await synthesizeSpeechThroughCache({
      mediaBlobStore: blobStore,
      text: 'hola',
      voiceId: 'voz-1',
      modelId: 'modelo-1',
      synthesize: async () => buildArrayBuffer([7, 8]),
    });

    expect(new Uint8Array(audioBuffer)).toEqual(new Uint8Array([7, 8]));
  });
});
