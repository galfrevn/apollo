import type { MemorySqlExecutor, MemorySqlRow } from '@/memory/store';

export function createDurableObjectSqlExecutor(
  sqlStorage: SqlStorage,
): MemorySqlExecutor {
  function executeMemorySqlQuery<Row extends MemorySqlRow>(
    query: string,
    ...bindValues: unknown[]
  ): readonly Row[];
  function executeMemorySqlQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    return sqlStorage.exec(query, ...bindValues).toArray();
  }
  return { execute: executeMemorySqlQuery };
}
