export type VectorRecord = {
  readonly id: string;
  readonly values: readonly number[];
  readonly namespace: string;
  readonly metadata: Record<string, string>;
};

export type VectorQuery = {
  readonly values: readonly number[];
  readonly namespace: string;
  readonly topK: number;
};

export type VectorMatch = {
  readonly id: string;
  readonly score: number;
  readonly metadata: Record<string, unknown> | undefined;
};

export type VectorStore = {
  upsert(record: VectorRecord): Promise<void>;
  query(query: VectorQuery): Promise<readonly VectorMatch[]>;
  deleteByIds(idList: readonly string[]): Promise<void>;
};
