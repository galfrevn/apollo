import { describe, expect, it } from 'bun:test';

import {
  isConsoleReadableDocumentKey,
  listConsoleJobDocuments,
  readConsoleJobDocument,
} from '@/console/jobs';
import type { ConsoleDocumentBucket } from '@/console/jobs';

function createFakeDocumentBucket(
  objectMap: Record<string, { uploaded: Date; content: string }>,
): ConsoleDocumentBucket {
  return {
    async list({ prefix }) {
      return {
        objects: Object.entries(objectMap)
          .filter(([key]) => key.startsWith(prefix))
          .map(([key, value]) => ({
            key,
            uploaded: value.uploaded,
            size: value.content.length,
          })),
      };
    },
    async get(key) {
      const object = objectMap[key];
      return object === undefined ? null : { text: async () => object.content };
    },
  };
}

describe('console job documents', () => {
  const bucket = createFakeDocumentBucket({
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

  it('guards key prefixes strictly', () => {
    expect(isConsoleReadableDocumentKey('research/desk/x.md', 'desk')).toBe(true);
    expect(isConsoleReadableDocumentKey('research/desk2/x.md', 'desk')).toBe(false);
    expect(isConsoleReadableDocumentKey('skills/desk/x.md', 'desk')).toBe(false);
  });
});
