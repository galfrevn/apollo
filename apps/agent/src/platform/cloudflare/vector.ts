import type { VectorStore } from '@/platform/vector';

export function createVectorizeVectorStore(vectorizeIndex: VectorizeIndex): VectorStore {
  return {
    async upsert(record) {
      await vectorizeIndex.upsert([
        {
          id: record.id,
          values: [...record.values],
          namespace: record.namespace,
          metadata: record.metadata,
        },
      ]);
    },
    async query(query) {
      const queryResult = await vectorizeIndex.query([...query.values], {
        topK: query.topK,
        namespace: query.namespace,
        returnMetadata: 'all',
      });
      return queryResult.matches.map((match) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata,
      }));
    },
    async deleteByIds(idList) {
      await vectorizeIndex.deleteByIds([...idList]);
    },
  };
}
