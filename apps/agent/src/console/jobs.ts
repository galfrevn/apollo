import type { BlobListOptions, BlobStore } from '@/platform/blob';

export type ConsoleJobDocument = {
  readonly documentKey: string;
  readonly kind: 'research' | 'coding';
  readonly uploadedAtIso: string;
  readonly sizeBytes: number;
};

const JOB_KIND_PREFIX_LIST = ['research', 'coding'] as const;
const JOB_LISTING_PAGE_SIZE = 500;
const JOB_LISTING_MAX_DOCUMENTS_PER_KIND = 2_000;

export async function listConsoleJobDocuments(
  mediaBlobStore: BlobStore,
  deviceId: string,
): Promise<readonly ConsoleJobDocument[]> {
  const documentList: ConsoleJobDocument[] = [];
  for (const kind of JOB_KIND_PREFIX_LIST) {
    let cursor: string | undefined;
    let collectedCount = 0;
    do {
      const listingOptions: BlobListOptions = {
        prefix: `${kind}/${deviceId}/`,
        limit: JOB_LISTING_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
      };
      const listing = await mediaBlobStore.list(listingOptions);
      for (const listedEntry of listing.entryList) {
        documentList.push({
          documentKey: listedEntry.key,
          kind,
          uploadedAtIso: new Date(listedEntry.uploadedAtMilliseconds).toISOString(),
          sizeBytes: listedEntry.size,
        });
      }
      collectedCount += listing.entryList.length;
      cursor = listing.isTruncated ? listing.cursor : undefined;
    } while (cursor !== undefined && collectedCount < JOB_LISTING_MAX_DOCUMENTS_PER_KIND);
  }
  return documentList.toSorted((left, right) =>
    right.uploadedAtIso.localeCompare(left.uploadedAtIso),
  );
}

export function isConsoleReadableDocumentKey(
  documentKey: string,
  deviceId: string,
): boolean {
  return JOB_KIND_PREFIX_LIST.some((kind) =>
    documentKey.startsWith(`${kind}/${deviceId}/`),
  );
}

export async function readConsoleJobDocument(
  mediaBlobStore: BlobStore,
  deviceId: string,
  documentKey: string,
): Promise<string | null> {
  if (!isConsoleReadableDocumentKey(documentKey, deviceId)) {
    return null;
  }
  const storedObject = await mediaBlobStore.get(documentKey);
  if (storedObject === null) {
    return null;
  }
  return storedObject.text();
}
