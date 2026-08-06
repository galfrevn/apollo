export type MemoryRecord = {
  readonly id: string;
  readonly content: string;
  readonly createdAt: number;
};

export type MemorySqlExecutor = {
  execute<Row extends Record<string, unknown>>(
    query: string,
    ...bindValues: unknown[]
  ): readonly Row[];
};

export async function addMemoryRecord(
  sqlExecutor: MemorySqlExecutor,
  content: string,
  nowMilliseconds: number = Date.now(),
  createIdentifier: () => string = () => crypto.randomUUID(),
): Promise<MemoryRecord> {
  const memoryRecord: MemoryRecord = {
    id: createIdentifier(),
    content,
    createdAt: nowMilliseconds,
  };
  sqlExecutor.execute(
    'INSERT INTO memories (id, content, created_at) VALUES (?, ?, ?)',
    memoryRecord.id,
    memoryRecord.content,
    memoryRecord.createdAt,
  );
  return memoryRecord;
}

export async function listRecentMemoryRecords(
  sqlExecutor: MemorySqlExecutor,
  limit: number,
): Promise<readonly MemoryRecord[]> {
  const rows = sqlExecutor.execute<{
    id: string;
    content: string;
    created_at: number;
  }>(
    'SELECT id, content, created_at FROM memories ORDER BY created_at DESC LIMIT ?',
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function recallMemoryRecords(
  sqlExecutor: MemorySqlExecutor,
  queryText: string,
  limit: number,
): Promise<readonly MemoryRecord[]> {
  const trimmedQuery = queryText.trim();
  if (trimmedQuery.length === 0) {
    return listRecentMemoryRecords(sqlExecutor, limit);
  }

  const keywordList = trimmedQuery
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((keyword) => keyword.length >= 4);

  const matchedRecordMap = new Map<string, MemoryRecord>();
  for (const keyword of keywordList) {
    const rows = sqlExecutor.execute<{
      id: string;
      content: string;
      created_at: number;
    }>(
      'SELECT id, content, created_at FROM memories WHERE content LIKE ? ORDER BY created_at DESC LIMIT ?',
      `%${keyword}%`,
      limit,
    );
    for (const row of rows) {
      matchedRecordMap.set(row.id, {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
      });
    }
  }

  if (matchedRecordMap.size > 0) {
    return [...matchedRecordMap.values()]
      .toSorted((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  }

  return listRecentMemoryRecords(sqlExecutor, limit);
}

export async function getSessionPreference(
  sqlExecutor: MemorySqlExecutor,
  preferenceKey: string,
): Promise<string | null> {
  const rows = sqlExecutor.execute<{ value: string }>(
    'SELECT value FROM session_prefs WHERE key = ? LIMIT 1',
    preferenceKey,
  );
  return rows[0]?.value ?? null;
}

export async function setSessionPreference(
  sqlExecutor: MemorySqlExecutor,
  preferenceKey: string,
  preferenceValue: string,
): Promise<void> {
  sqlExecutor.execute(
    'INSERT INTO session_prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    preferenceKey,
    preferenceValue,
  );
}
