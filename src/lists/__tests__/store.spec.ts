import { describe, expect, it } from 'bun:test';

import {
  addListItemRecord,
  listListItemRecords,
  removeListItemRecords,
} from '@/lists/store';
import type { MemorySqlExecutor } from '@/memory/store';

function createInMemoryListSqlExecutor(): MemorySqlExecutor {
  const rowList: Array<{
    id: string;
    list_name: string;
    content: string;
    created_at: number;
  }> = [];
  return {
    execute<Row extends Record<string, unknown>>(
      query: string,
      ...bindValues: unknown[]
    ): readonly Row[] {
      if (query.startsWith('INSERT INTO list_items')) {
        rowList.push({
          id: String(bindValues[0]),
          list_name: String(bindValues[1]),
          content: String(bindValues[2]),
          created_at: Number(bindValues[3]),
        });
        return [];
      }
      if (query.startsWith('DELETE FROM list_items')) {
        const targetId = String(bindValues[0]);
        const targetIndex = rowList.findIndex((row) => row.id === targetId);
        if (targetIndex >= 0) {
          rowList.splice(targetIndex, 1);
        }
        return [];
      }
      if (query.includes('AND content LIKE')) {
        const listName = String(bindValues[0]);
        const likePattern = String(bindValues[1]).replaceAll('%', '').toLowerCase();
        return rowList.filter(
          (row) =>
            row.list_name === listName &&
            row.content.toLowerCase().includes(likePattern),
        ) as unknown as readonly Row[];
      }
      if (query.includes('WHERE list_name = ?')) {
        const listName = String(bindValues[0]);
        return rowList.filter(
          (row) => row.list_name === listName,
        ) as unknown as readonly Row[];
      }
      return [...rowList] as unknown as readonly Row[];
    },
  };
}

describe('list store', () => {
  it('adds and reads items per list, or all lists at once', async () => {
    const sqlExecutor = createInMemoryListSqlExecutor();
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'yerba' }, 1);
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'pan' }, 2);
    await addListItemRecord(sqlExecutor, { listName: 'regalos', content: 'libro' }, 3);

    const superItems = await listListItemRecords(sqlExecutor, 'super');
    expect(superItems.map((item) => item.content)).toEqual(['yerba', 'pan']);

    const allItems = await listListItemRecords(sqlExecutor);
    expect(allItems).toHaveLength(3);
  });

  it('removes by partial match and clears whole lists', async () => {
    const sqlExecutor = createInMemoryListSqlExecutor();
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'yerba' }, 1);
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'pan lactal' }, 2);

    const partialRemoval = await removeListItemRecords(sqlExecutor, {
      listName: 'super',
      contentQuery: 'pan',
      clearAll: false,
    });
    expect(partialRemoval.removedCount).toBe(1);
    expect(partialRemoval.removedContentList).toEqual(['pan lactal']);

    const clearRemoval = await removeListItemRecords(sqlExecutor, {
      listName: 'super',
      clearAll: true,
    });
    expect(clearRemoval.removedCount).toBe(1);
    expect(await listListItemRecords(sqlExecutor, 'super')).toEqual([]);
  });

  it('never wipes a list when the content query is blank and clearAll is off', async () => {
    const sqlExecutor = createInMemoryListSqlExecutor();
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'yerba' }, 1);
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'pan' }, 2);

    for (const contentQuery of [undefined, '', '   ']) {
      const removal = await removeListItemRecords(sqlExecutor, {
        listName: 'super',
        ...(contentQuery === undefined ? {} : { contentQuery }),
        clearAll: false,
      });
      expect(removal.removedCount).toBe(0);
    }

    expect(await listListItemRecords(sqlExecutor, 'super')).toHaveLength(2);
  });
});
