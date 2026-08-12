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
};

export type ConsoleDocumentBucket = {
  list(options: { prefix: string; limit?: number }): Promise<BucketListingLike>;
  get(key: string): Promise<{ text(): Promise<string> } | null>;
};

const JOB_KIND_PREFIX_LIST = ['research', 'coding'] as const;
const JOB_LISTING_LIMIT_PER_KIND = 50;

export async function listConsoleJobDocuments(
  bucket: ConsoleDocumentBucket,
  deviceId: string,
): Promise<readonly ConsoleJobDocument[]> {
  const documentList: ConsoleJobDocument[] = [];
  for (const kind of JOB_KIND_PREFIX_LIST) {
    const listing = await bucket.list({
      prefix: `${kind}/${deviceId}/`,
      limit: JOB_LISTING_LIMIT_PER_KIND,
    });
    for (const object of listing.objects) {
      documentList.push({
        documentKey: object.key,
        kind,
        uploadedAtIso: object.uploaded.toISOString(),
        sizeBytes: object.size,
      });
    }
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
