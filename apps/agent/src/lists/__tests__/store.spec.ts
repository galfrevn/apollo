import { describe, expect, it } from 'bun:test';

import {
  addListItemRecord,
  listListItemRecords,
  removeListItemRecordById,
  removeListItemRecords,
} from '@/lists/store';
import type { MemorySqlExecutor } from '@/memory/store';

type ListItemRow = {
  id: string;
  list_name: string;
  content: string;
  created_at: number;
};

function createInMemoryListSqlExecutor(): MemorySqlExecutor {
  const rowList: ListItemRow[] = [];
  const inMemoryExecutor = {
    execute(query: string, ...bindValues: unknown[]): readonly ListItemRow[] {
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
            row.list_name === listName && row.content.toLowerCase().includes(likePattern),
        );
      }
      if (query.includes('WHERE list_name = ?')) {
        const listName = String(bindValues[0]);
        return rowList.filter((row) => row.list_name === listName);
      }
      return [...rowList];
    },
  };
  // SAFETY: the double stores full list_items rows and every branch returns
  // them unchanged, so the Row type each store function requests always
  // describes the rows it receives.
  return inMemoryExecutor as MemorySqlExecutor;
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

  it('removes a single item by id', async () => {
    const sqlExecutor = createInMemoryListSqlExecutor();
    const keptItem = await addListItemRecord(
      sqlExecutor,
      { listName: 'super', content: 'yerba' },
      1,
    );
    const removedItem = await addListItemRecord(
      sqlExecutor,
      { listName: 'super', content: 'pan' },
      2,
    );

    await removeListItemRecordById(sqlExecutor, removedItem.id);

    const remainingItemList = await listListItemRecords(sqlExecutor, 'super');
    expect(remainingItemList.map((item) => item.id)).toEqual([keptItem.id]);
  });

  it('never wipes a list when the content query is blank and clearAll is off', async () => {
    const sqlExecutor = createInMemoryListSqlExecutor();
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'yerba' }, 1);
    await addListItemRecord(sqlExecutor, { listName: 'super', content: 'pan' }, 2);

    const omittedQueryRemoval = await removeListItemRecords(sqlExecutor, {
      listName: 'super',
      clearAll: false,
    });
    expect(omittedQueryRemoval.removedCount).toBe(0);

    for (const blankContentQuery of ['', '   ']) {
      const removal = await removeListItemRecords(sqlExecutor, {
        listName: 'super',
        contentQuery: blankContentQuery,
        clearAll: false,
      });
      expect(removal.removedCount).toBe(0);
    }

    expect(await listListItemRecords(sqlExecutor, 'super')).toHaveLength(2);
  });
});
