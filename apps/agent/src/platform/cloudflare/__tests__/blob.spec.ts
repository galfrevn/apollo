import { describe, expect, test } from 'bun:test';

import { createR2BlobStore } from '@/platform/cloudflare/blob';

type StoredObject = {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly uploaded: Date;
  readonly contentType?: string;
};

function createStubR2Bucket(initialObjectList: readonly StoredObject[] = []) {
  const storedObjectMap = new Map<string, StoredObject>(
    initialObjectList.map((storedObject) => [storedObject.key, storedObject]),
  );
  const putCallList: { key: string; contentType?: string }[] = [];
  const partialBucket = {
    async get(objectKey: string) {
      const storedObject = storedObjectMap.get(objectKey);
      if (storedObject === undefined) {
        return null;
      }
      const storedText = new TextDecoder().decode(storedObject.bytes);
      return {
        size: storedObject.bytes.byteLength,
        body: new Response(storedObject.bytes).body,
        async arrayBuffer() {
          return storedObject.bytes.buffer.slice(
            storedObject.bytes.byteOffset,
            storedObject.bytes.byteOffset + storedObject.bytes.byteLength,
          );
        },
        async text() {
          return storedText;
        },
        async json() {
          const parsedJson: unknown = JSON.parse(storedText);
          return parsedJson;
        },
      };
    },
    async put(
      objectKey: string,
      content: string | ArrayBuffer | Uint8Array,
      options?: { httpMetadata?: { contentType?: string } },
    ) {
      const contentBytes =
        content instanceof Uint8Array
          ? content
          : content instanceof ArrayBuffer
            ? new Uint8Array(content)
            : new TextEncoder().encode(content);
      putCallList.push({
        key: objectKey,
        contentType: options?.httpMetadata?.contentType,
      });
      storedObjectMap.set(objectKey, {
        key: objectKey,
        bytes: contentBytes,
        uploaded: new Date(0),
      });
      return null;
    },
    async delete(objectKey: string) {
      storedObjectMap.delete(objectKey);
    },
    async list(options: { prefix?: string; limit?: number; cursor?: string }) {
      const matchingObjectList = [...storedObjectMap.values()].filter((storedObject) =>
        storedObject.key.startsWith(options.prefix ?? ''),
      );
      const startIndex = options.cursor === undefined ? 0 : Number(options.cursor);
      const pageSize = options.limit ?? matchingObjectList.length;
      const pageObjectList = matchingObjectList.slice(startIndex, startIndex + pageSize);
      const nextIndex = startIndex + pageObjectList.length;
      const truncated = nextIndex < matchingObjectList.length;
      return {
        objects: pageObjectList.map((storedObject) => ({
          key: storedObject.key,
          size: storedObject.bytes.byteLength,
          uploaded: storedObject.uploaded,
        })),
        truncated,
        ...(truncated ? { cursor: String(nextIndex) } : {}),
      };
    },
  };
  return {
    putCallList,
    storedObjectMap,
    // SAFETY: the adapter only calls get, put, delete, and list, which the stub
    // implements with the exact R2 shapes those calls read.
    bucket: partialBucket as R2Bucket,
  };
}

describe('createR2BlobStore', () => {
  test('get maps the R2 object body surface and returns null on a miss', async () => {
    const { bucket } = createStubR2Bucket([
      {
        key: 'firmware/latest.json',
        bytes: new TextEncoder().encode('{"version":"2.7.0"}'),
        uploaded: new Date(1_700_000_000_000),
      },
    ]);
    const blobStore = createR2BlobStore(bucket);

    const storedObject = await blobStore.get('firmware/latest.json');
    expect(storedObject).not.toBeNull();
    expect(storedObject?.size).toBe(19);
    expect(await storedObject?.text()).toBe('{"version":"2.7.0"}');
    expect(await storedObject?.json()).toEqual({ version: '2.7.0' });
    expect(await blobStore.get('missing-key')).toBeNull();
  });

  test('put forwards the content type as R2 http metadata', async () => {
    const { bucket, putCallList } = createStubR2Bucket();
    const blobStore = createR2BlobStore(bucket);

    await blobStore.put('research/desk/report', '# informe', {
      contentType: 'text/markdown; charset=utf-8',
    });
    await blobStore.put('tts-cache/abc.pcm', new ArrayBuffer(4));

    expect(putCallList).toEqual([
      { key: 'research/desk/report', contentType: 'text/markdown; charset=utf-8' },
      { key: 'tts-cache/abc.pcm', contentType: undefined },
    ]);
  });

  test('list maps uploaded dates to milliseconds and paginates by cursor', async () => {
    const uploadedAt = new Date(1_700_000_000_000);
    const { bucket } = createStubR2Bucket([
      { key: 'research/desk/a', bytes: new Uint8Array(1), uploaded: uploadedAt },
      { key: 'research/desk/b', bytes: new Uint8Array(2), uploaded: uploadedAt },
      { key: 'coding/desk/c', bytes: new Uint8Array(3), uploaded: uploadedAt },
    ]);
    const blobStore = createR2BlobStore(bucket);

    const firstPage = await blobStore.list({ prefix: 'research/desk/', limit: 1 });
    expect(firstPage.entryList).toEqual([
      { key: 'research/desk/a', size: 1, uploadedAtMilliseconds: 1_700_000_000_000 },
    ]);
    expect(firstPage.isTruncated).toBe(true);
    expect(firstPage.cursor).toBeDefined();

    const secondPage = await blobStore.list({
      prefix: 'research/desk/',
      limit: 1,
      cursor: firstPage.cursor,
    });
    expect(secondPage.entryList.map((entry) => entry.key)).toEqual(['research/desk/b']);
    expect(secondPage.isTruncated).toBe(false);
    expect(secondPage.cursor).toBeUndefined();
  });

  test('delete removes the stored object', async () => {
    const { bucket, storedObjectMap } = createStubR2Bucket([
      { key: 'broadcast/audio', bytes: new Uint8Array(8), uploaded: new Date(0) },
    ]);
    const blobStore = createR2BlobStore(bucket);

    await blobStore.delete('broadcast/audio');
    expect(storedObjectMap.size).toBe(0);
  });
});
