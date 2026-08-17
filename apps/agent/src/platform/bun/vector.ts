import type { Database } from 'bun:sqlite';

import type { VectorStore } from '@/platform/vector';

const VECTOR_TABLE_DDL = `CREATE TABLE IF NOT EXISTS host_vectors (
  id TEXT PRIMARY KEY,
  namespace TEXT NOT NULL,
  values_json TEXT NOT NULL,
  metadata_json TEXT NOT NULL
)`;

// Brute-force cosine over a SQLite table: a personal agent holds thousands of
// memories, not millions, so a scan per recall stays microseconds-cheap and
// avoids a native vector extension.
export function createSqliteVectorStore(database: Database): VectorStore {
  database.run(VECTOR_TABLE_DDL);
  return {
    async upsert(record) {
      database.run(
        `INSERT INTO host_vectors (id, namespace, values_json, metadata_json)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           namespace = excluded.namespace,
           values_json = excluded.values_json,
           metadata_json = excluded.metadata_json`,
        [
          record.id,
          record.namespace,
          JSON.stringify(record.values),
          JSON.stringify(record.metadata),
        ],
      );
    },
    async query(query) {
      const rowList = database
        .query(
          'SELECT id, values_json, metadata_json FROM host_vectors WHERE namespace = ?',
        )
        .all(query.namespace) as {
        id: string;
        values_json: string;
        metadata_json: string;
      }[];
      return rowList
        .map((row) => {
          const storedValues = JSON.parse(row.values_json) as number[];
          const storedMetadata = JSON.parse(row.metadata_json) as Record<string, unknown>;
          return {
            id: row.id,
            score: computeCosineSimilarity(query.values, storedValues),
            metadata: storedMetadata,
          };
        })
        .toSorted((left, right) => right.score - left.score)
        .slice(0, query.topK);
    },
    async deleteByIds(idList) {
      for (const vectorId of idList) {
        database.run('DELETE FROM host_vectors WHERE id = ?', [vectorId]);
      }
    },
  };
}

export function computeCosineSimilarity(
  leftValues: readonly number[],
  rightValues: readonly number[],
): number {
  const sharedLength = Math.min(leftValues.length, rightValues.length);
  let dotProduct = 0;
  let leftMagnitudeSquared = 0;
  let rightMagnitudeSquared = 0;
  for (let index = 0; index < sharedLength; index += 1) {
    dotProduct += leftValues[index] * rightValues[index];
    leftMagnitudeSquared += leftValues[index] * leftValues[index];
    rightMagnitudeSquared += rightValues[index] * rightValues[index];
  }
  const magnitudeProduct = Math.sqrt(leftMagnitudeSquared * rightMagnitudeSquared);
  if (magnitudeProduct === 0) {
    return 0;
  }
  return dotProduct / magnitudeProduct;
}
