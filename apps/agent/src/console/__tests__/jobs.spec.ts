import { describe, expect, it } from 'bun:test';

import {
  isConsoleReadableDocumentKey,
  listConsoleJobDocuments,
  readConsoleJobDocument,
} from '@/console/jobs';
import type { BlobStore } from '@/platform/blob';

function createFakeDocumentBlobStore(
  objectMap: Record<string, { uploaded: Date; content: string }>,
  pageSize?: number,
): BlobStore {
  return {
    async list({ prefix, cursor }) {
      const matchingEntryList = Object.entries(objectMap)
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, value]) => ({
          key,
          uploadedAtMilliseconds: value.uploaded.getTime(),
          size: value.content.length,
        }));
      const startIndex = cursor === undefined ? 0 : Number(cursor);
      const endIndex =
        pageSize === undefined ? matchingEntryList.length : startIndex + pageSize;
      const pageEntryList = matchingEntryList.slice(startIndex, endIndex);
      if (endIndex < matchingEntryList.length) {
        return { entryList: pageEntryList, isTruncated: true, cursor: String(endIndex) };
      }
      return { entryList: pageEntryList, isTruncated: false };
    },
    async get(objectKey) {
      const storedDocument = objectMap[objectKey];
      if (storedDocument === undefined) {
        return null;
      }
      return {
        size: storedDocument.content.length,
        body: null,
        arrayBuffer: async () => {
          const encodedBytes = new TextEncoder().encode(storedDocument.content);
          const contentBuffer = new ArrayBuffer(encodedBytes.byteLength);
          new Uint8Array(contentBuffer).set(encodedBytes);
          return contentBuffer;
        },
        text: async () => storedDocument.content,
        json: async (): Promise<unknown> => JSON.parse(storedDocument.content),
      };
    },
    async put() {},
    async delete() {},
  };
}

describe('console job documents', () => {
  const bucket = createFakeDocumentBlobStore({
    'research/desk/run-1.md': { uploaded: new Date('2026-08-01'), content: '# uno' },
    'research/desk/run-2.md': { uploaded: new Date('2026-08-10'), content: '# dos' },
    'coding/desk/run-3.md': { uploaded: new Date('2026-08-05'), content: '# tres' },
    'research/other/run-4.md': { uploaded: new Date('2026-08-11'), content: '# ajeno' },
    'firmware/latest.json': { uploaded: new Date('2026-08-11'), content: '{}' },
  });

  it('lists research and coding documents for the device, newest first', async () => {
    const documentList = await listConsoleJobDocuments(bucket, 'desk');
    expect(documentList.map((document) => document.documentKey)).toEqual([
      'research/desk/run-2.md',
      'coding/desk/run-3.md',
      'research/desk/run-1.md',
    ]);
    expect(documentList[0]?.kind).toBe('research');
    expect(documentList[1]?.kind).toBe('coding');
  });

  it('reads a document only inside the device prefixes', async () => {
    await expect(
      readConsoleJobDocument(bucket, 'desk', 'coding/desk/run-3.md'),
    ).resolves.toBe('# tres');
    await expect(
      readConsoleJobDocument(bucket, 'desk', 'research/other/run-4.md'),
    ).resolves.toBeNull();
    await expect(
      readConsoleJobDocument(bucket, 'desk', 'firmware/latest.json'),
    ).resolves.toBeNull();
  });

  it('follows the listing cursor across pages', async () => {
    const paginatedBucket = createFakeDocumentBlobStore(
      {
        'research/desk/a.md': { uploaded: new Date('2026-08-01'), content: 'a' },
        'research/desk/b.md': { uploaded: new Date('2026-08-02'), content: 'b' },
        'research/desk/c.md': { uploaded: new Date('2026-08-03'), content: 'c' },
      },
      1,
    );

    const documentList = await listConsoleJobDocuments(paginatedBucket, 'desk');

    expect(documentList).toHaveLength(3);
    expect(documentList[0]?.documentKey).toBe('research/desk/c.md');
  });

  it('guards key prefixes strictly', () => {
    expect(isConsoleReadableDocumentKey('research/desk/x.md', 'desk')).toBe(true);
    expect(isConsoleReadableDocumentKey('research/desk2/x.md', 'desk')).toBe(false);
    expect(isConsoleReadableDocumentKey('skills/desk/x.md', 'desk')).toBe(false);
  });
});
