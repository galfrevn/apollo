export type ConsoleJobDocument = {
  readonly documentKey: string;
  readonly kind: 'research' | 'coding';
  readonly uploadedAtIso: string;
  readonly sizeBytes: number;
};

type BucketListingLike = {
  readonly objects: readonly {
    readonly key: string;
    readonly uploaded: Date;
    readonly size: number;
  }[];
  readonly truncated: boolean;
  readonly cursor?: string;
};

export type ConsoleDocumentBucket = {
  list(options: {
    prefix: string;
    limit?: number;
    cursor?: string;
  }): Promise<BucketListingLike>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
};

const JOB_KIND_PREFIX_LIST = ['research', 'coding'] as const;
const JOB_LISTING_PAGE_SIZE = 500;
const JOB_LISTING_MAX_DOCUMENTS_PER_KIND = 2_000;

export async function listConsoleJobDocuments(
  bucket: ConsoleDocumentBucket,
  deviceId: string,
): Promise<readonly ConsoleJobDocument[]> {
  const documentList: ConsoleJobDocument[] = [];
  for (const kind of JOB_KIND_PREFIX_LIST) {
    let cursor: string | undefined;
    let collectedCount = 0;
    do {
      const listing = await bucket.list({
        prefix: `${kind}/${deviceId}/`,
        limit: JOB_LISTING_PAGE_SIZE,
        ...(cursor === undefined ? {} : { cursor }),
      });
      for (const object of listing.objects) {
        documentList.push({
          documentKey: object.key,
          kind,
          uploadedAtIso: object.uploaded.toISOString(),
          sizeBytes: object.size,
        });
      }
      collectedCount += listing.objects.length;
      cursor = listing.truncated ? listing.cursor : undefined;
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
  bucket: ConsoleDocumentBucket,
  deviceId: string,
  documentKey: string,
): Promise<string | null> {
  if (!isConsoleReadableDocumentKey(documentKey, deviceId)) {
    return null;
  }
  const object = await bucket.get(documentKey);
  if (object === null) {
    return null;
  }
  return object.text();
}
