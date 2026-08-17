import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import type { Dirent } from 'node:fs';

import type { BlobListEntry, BlobStore } from '@/platform/blob';

export function createFileBlobStore(rootDirectory: string): BlobStore {
  function resolveObjectPath(objectKey: string): string {
    const segmentList = objectKey.split('/');
    if (
      segmentList.some(
        (segment) => segment.length === 0 || segment === '.' || segment === '..',
      )
    ) {
      throw new Error(`Invalid blob object key: ${objectKey}`);
    }
    return join(rootDirectory, ...segmentList);
  }

  return {
    async get(objectKey) {
      const objectPath = resolveObjectPath(objectKey);
      const objectFile = Bun.file(objectPath);
      if (!(await objectFile.exists())) {
        return null;
      }
      return {
        size: objectFile.size,
        body: objectFile.stream(),
        arrayBuffer: () => objectFile.arrayBuffer(),
        text: () => objectFile.text(),
        json: async (): Promise<unknown> => JSON.parse(await objectFile.text()),
      };
    },
    async put(objectKey, content) {
      const objectPath = resolveObjectPath(objectKey);
      await mkdir(dirname(objectPath), { recursive: true });
      await Bun.write(objectPath, content);
    },
    async delete(objectKey) {
      await rm(resolveObjectPath(objectKey), { force: true });
    },
    async list(options) {
      const allEntryList = await collectBlobEntryList(rootDirectory);
      const matchingEntryList = allEntryList
        .filter((entry) => entry.key.startsWith(options.prefix))
        .toSorted((left, right) => left.key.localeCompare(right.key));
      const startIndex =
        options.cursor === undefined
          ? 0
          : matchingEntryList.findIndex((entry) => entry.key > (options.cursor ?? ''));
      const safeStartIndex = startIndex < 0 ? matchingEntryList.length : startIndex;
      const pageSize = options.limit ?? matchingEntryList.length;
      const pageEntryList = matchingEntryList.slice(
        safeStartIndex,
        safeStartIndex + pageSize,
      );
      const isTruncated =
        safeStartIndex + pageEntryList.length < matchingEntryList.length;
      const lastEntry = pageEntryList[pageEntryList.length - 1];
      return {
        entryList: pageEntryList,
        isTruncated,
        ...(isTruncated && lastEntry !== undefined ? { cursor: lastEntry.key } : {}),
      };
    },
  };
}

async function collectBlobEntryList(rootDirectory: string): Promise<BlobListEntry[]> {
  let directoryEntryList: Dirent[];
  try {
    directoryEntryList = await readdir(rootDirectory, {
      recursive: true,
      withFileTypes: true,
    });
  } catch {
    return [];
  }
  const entryList: BlobListEntry[] = [];
  for (const directoryEntry of directoryEntryList) {
    if (!directoryEntry.isFile()) {
      continue;
    }
    const filePath = join(directoryEntry.parentPath, directoryEntry.name);
    const fileStat = await stat(filePath);
    entryList.push({
      key: relative(rootDirectory, filePath).split(sep).join('/'),
      size: fileStat.size,
      uploadedAtMilliseconds: Math.floor(fileStat.mtimeMs),
    });
  }
  return entryList;
}
