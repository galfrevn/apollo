import type { MemorySqlExecutor } from '@/memory/store';

export type ListItemRecord = {
  readonly id: string;
  readonly listName: string;
  readonly content: string;
  readonly createdAt: number;
};

type ListItemRow = {
  id: string;
  list_name: string;
  content: string;
  created_at: number;
};

const LIST_ITEM_COLUMNS = 'id, list_name, content, created_at';

function toListItemRecord(row: ListItemRow): ListItemRecord {
  return {
    id: row.id,
    listName: row.list_name,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function addListItemRecord(
  sqlExecutor: MemorySqlExecutor,
  input: { readonly listName: string; readonly content: string },
  nowMilliseconds: number = Date.now(),
  createIdentifier: () => string = () => crypto.randomUUID(),
): Promise<ListItemRecord> {
  const itemRecord: ListItemRecord = {
    id: createIdentifier(),
    listName: input.listName,
    content: input.content,
    createdAt: nowMilliseconds,
  };
  sqlExecutor.execute(
    `INSERT INTO list_items (${LIST_ITEM_COLUMNS}) VALUES (?, ?, ?, ?)`,
    itemRecord.id,
    itemRecord.listName,
    itemRecord.content,
    itemRecord.createdAt,
  );
  return itemRecord;
}

// Without a list name it returns every list's items, so "qué tenía anotado"
// works even when the user forgets which list they used.
export async function listListItemRecords(
  sqlExecutor: MemorySqlExecutor,
  listName?: string,
): Promise<readonly ListItemRecord[]> {
  const rowList =
    listName === undefined
      ? sqlExecutor.execute<ListItemRow>(
          `SELECT ${LIST_ITEM_COLUMNS} FROM list_items ORDER BY list_name, created_at`,
        )
      : sqlExecutor.execute<ListItemRow>(
          `SELECT ${LIST_ITEM_COLUMNS} FROM list_items WHERE list_name = ? ORDER BY created_at`,
          listName,
        );
  return rowList.map(toListItemRecord);
}

export async function removeListItemRecordById(
  sqlExecutor: MemorySqlExecutor,
  itemId: string,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM list_items WHERE id = ?', itemId);
}

export async function removeListItemRecords(
  sqlExecutor: MemorySqlExecutor,
  input: {
    readonly listName: string;
    readonly contentQuery?: string;
    readonly clearAll: boolean;
  },
): Promise<{
  readonly removedCount: number;
  readonly removedContentList: readonly string[];
}> {
  // A blank query would compile to LIKE '%%' and wipe the list, so only an
  // explicit clearAll is allowed to delete everything.
  if (!input.clearAll && (input.contentQuery ?? '').trim() === '') {
    return { removedCount: 0, removedContentList: [] };
  }

  const matchedRowList = input.clearAll
    ? sqlExecutor.execute<{ id: string; content: string }>(
        'SELECT id, content FROM list_items WHERE list_name = ?',
        input.listName,
      )
    : sqlExecutor.execute<{ id: string; content: string }>(
        'SELECT id, content FROM list_items WHERE list_name = ? AND content LIKE ?',
        input.listName,
        `%${input.contentQuery}%`,
      );

  for (const row of matchedRowList) {
    sqlExecutor.execute('DELETE FROM list_items WHERE id = ?', row.id);
  }

  return {
    removedCount: matchedRowList.length,
    removedContentList: matchedRowList.map((row) => row.content),
  };
}
