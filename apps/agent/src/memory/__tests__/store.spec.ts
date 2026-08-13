import { describe, expect, it } from 'bun:test';

import {
  addMemoryRecord,
  getSessionPreference,
  listRecentMemoryRecords,
  recallMemoryRecords,
  setSessionPreference,
  type MemorySqlExecutor,
  type MemorySqlRow,
} from '@/memory/store';

function createInMemorySqlExecutor(): MemorySqlExecutor {
  const memoryRowList: Array<{
    id: string;
    content: string;
    created_at: number;
  }> = [];
  const preferenceMap = new Map<string, string>();

  function executeFakeQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    if (query.startsWith('INSERT INTO memories')) {
      memoryRowList.push({
        id: String(bindValues[0]),
        content: String(bindValues[1]),
        created_at: Number(bindValues[2]),
      });
      return [];
    }
    if (query.startsWith('SELECT id, content, created_at FROM memories WHERE')) {
      const likePattern = String(bindValues[0]).replaceAll('%', '');
      const limit = Number(bindValues[1]);
      return memoryRowList
        .filter((row) => row.content.includes(likePattern))
        .toSorted((left, right) => right.created_at - left.created_at)
        .slice(0, limit);
    }
    if (query.startsWith('SELECT id, content, created_at FROM memories')) {
      const limit = Number(bindValues[0]);
      return [...memoryRowList]
        .toSorted((left, right) => right.created_at - left.created_at)
        .slice(0, limit);
    }
    if (query.startsWith('SELECT value FROM session_prefs')) {
      const value = preferenceMap.get(String(bindValues[0]));
      return value === undefined ? [] : [{ value }];
    }
    if (query.startsWith('INSERT INTO session_prefs')) {
      preferenceMap.set(String(bindValues[0]), String(bindValues[1]));
      return [];
    }
    throw new Error(`Unsupported query in fake: ${query}`);
  }

  // SAFETY: every branch of the fake returns rows carrying exactly the columns
  // the matched production query selects, so the caller's Row type argument
  // always matches the rows handed back.
  return { execute: executeFakeQuery as MemorySqlExecutor['execute'] };
}

describe('memory store', () => {
  it('adds and lists recent memories', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await addMemoryRecord(sqlExecutor, 'me gusta el mate', 1000, () => 'mem-1');
    const recentList = await listRecentMemoryRecords(sqlExecutor, 5);
    expect(recentList).toEqual([
      { id: 'mem-1', content: 'me gusta el mate', createdAt: 1000 },
    ]);
  });

  it('recalls by query text', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await addMemoryRecord(sqlExecutor, 'tomo mate a la mañana', 1, () => 'a');
    await addMemoryRecord(sqlExecutor, 'prefiero té', 2, () => 'b');
    const recalledList = await recallMemoryRecords(sqlExecutor, 'mate', 5);
    expect(recalledList).toHaveLength(1);
    expect(recalledList[0]?.content).toContain('mate');
  });

  it('stores session prefs', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await setSessionPreference(sqlExecutor, 'speechMode', 'nerd');
    expect(await getSessionPreference(sqlExecutor, 'speechMode')).toBe('nerd');
  });
});
