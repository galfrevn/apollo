export type BlobPutOptions = {
  readonly contentType?: string;
};

export type BlobObjectBody = {
  readonly size: number;
  readonly body: ReadableStream<Uint8Array> | null;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json(): Promise<unknown>;
};

export type BlobListEntry = {
  readonly key: string;
  readonly size: number;
  readonly uploadedAtMilliseconds: number;
};

export type BlobListPage = {
  readonly entryList: readonly BlobListEntry[];
  readonly isTruncated: boolean;
  readonly cursor?: string;
};

export type BlobListOptions = {
  readonly prefix: string;
  readonly limit?: number;
  readonly cursor?: string;
};

export type BlobStore = {
  get(objectKey: string): Promise<BlobObjectBody | null>;
  put(
    objectKey: string,
    content: ArrayBuffer | Uint8Array | string,
    options?: BlobPutOptions,
  ): Promise<void>;
  delete(objectKey: string): Promise<void>;
  list(options: BlobListOptions): Promise<BlobListPage>;
};
