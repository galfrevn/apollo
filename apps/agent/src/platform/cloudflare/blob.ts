import type { BlobObjectBody, BlobStore } from '@/platform/blob';

export function createR2BlobStore(bucket: R2Bucket): BlobStore {
  return {
    async get(objectKey) {
      const storedObject = await bucket.get(objectKey);
      if (storedObject === null) {
        return null;
      }
      return wrapR2ObjectBody(storedObject);
    },
    async put(objectKey, content, options) {
      await bucket.put(
        objectKey,
        content,
        options?.contentType === undefined
          ? undefined
          : { httpMetadata: { contentType: options.contentType } },
      );
    },
    async delete(objectKey) {
      await bucket.delete(objectKey);
    },
    async list(options) {
      const listing = await bucket.list({
        prefix: options.prefix,
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.cursor === undefined ? {} : { cursor: options.cursor }),
      });
      return {
        entryList: listing.objects.map((storedObject) => ({
          key: storedObject.key,
          size: storedObject.size,
          uploadedAtMilliseconds: storedObject.uploaded.getTime(),
        })),
        isTruncated: listing.truncated,
        ...(listing.truncated ? { cursor: listing.cursor } : {}),
      };
    },
  };
}

function wrapR2ObjectBody(storedObject: R2ObjectBody): BlobObjectBody {
  return {
    size: storedObject.size,
    body: storedObject.body,
    arrayBuffer: () => storedObject.arrayBuffer(),
    text: () => storedObject.text(),
    json: async (): Promise<unknown> => storedObject.json(),
  };
}
