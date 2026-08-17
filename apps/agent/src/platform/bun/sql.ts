import type { Database } from 'bun:sqlite';

import type { MemorySqlExecutor, MemorySqlRow } from '@/memory/store';

// The SDK session manager's only host requirement: a synchronous tagged
// template over SQLite. Values are bound positionally; the SDK interpolation
// slots become `?` placeholders.
export type SqlTaggedTemplateProvider = {
  sql<Row = Record<string, string | number | boolean | null>>(
    strings: TemplateStringsArray,
    ...values: (string | number | boolean | null)[]
  ): Row[];
};

export function createBunSqliteExecutor(database: Database): MemorySqlExecutor {
  function executeMemorySqlQuery<Row extends MemorySqlRow>(
    query: string,
    ...bindValues: unknown[]
  ): readonly Row[];
  function executeMemorySqlQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    // SAFETY: callers bind only SQLite-compatible scalars, mirroring the
    // durable object executor whose SqlStorage carries the same contract.
    const boundValues = bindValues.map(normalizeSqliteBindValue) as (
      | string
      | number
      | null
    )[];
    return database.query(query).all(...boundValues) as MemorySqlRow[];
  }
  return { execute: executeMemorySqlQuery };
}

export function createBunSqliteSqlProvider(
  database: Database,
): SqlTaggedTemplateProvider {
  return {
    sql<Row>(
      strings: TemplateStringsArray,
      ...values: (string | number | boolean | null)[]
    ): Row[] {
      const query = strings.join('?');
      const boundValues = values.map(normalizeSqliteBindValue);
      return database.query(query).all(...boundValues) as Row[];
    },
  };
}

// bun:sqlite rejects booleans as bind parameters; SQLite stores them as 0/1,
// which is also how the durable object runtime marshals them.
function normalizeSqliteBindValue(value: unknown): string | number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  throw new Error(`Unsupported SQLite bind value type: ${typeof value}`);
}
