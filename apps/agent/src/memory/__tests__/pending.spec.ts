import { describe, expect, it } from 'bun:test';

import {
  deletePendingDeviceMessage,
  enqueuePendingDeviceMessage,
  listPendingDeviceMessages,
} from '@/memory/pending';
import type { MemorySqlExecutor, MemorySqlRow } from '@/memory/store';

function createInMemorySqlExecutor(): MemorySqlExecutor {
  const pendingRowList: Array<{
    id: string;
    type: string;
    payload_json: string;
    created_at: number;
  }> = [];

  function executeFakeQuery(
    query: string,
    ...bindValues: unknown[]
  ): readonly MemorySqlRow[] {
    if (query.startsWith('INSERT INTO pending_device_messages')) {
      pendingRowList.push({
        id: String(bindValues[0]),
        type: String(bindValues[1]),
        payload_json: String(bindValues[2]),
        created_at: Number(bindValues[3]),
      });
      return [];
    }
    if (query.startsWith('SELECT id, type, payload_json FROM pending_device_messages')) {
      return [...pendingRowList]
        .toSorted((left, right) => left.created_at - right.created_at)
        .map((row) => ({
          id: row.id,
          type: row.type,
          payload_json: row.payload_json,
        }));
    }
    if (query.startsWith('DELETE FROM pending_device_messages WHERE id = ?')) {
      const identifierToDelete = String(bindValues[0]);
      const rowIndex = pendingRowList.findIndex((row) => row.id === identifierToDelete);
      if (rowIndex >= 0) {
        pendingRowList.splice(rowIndex, 1);
      }
      return [];
    }
    throw new Error(`Unsupported query in fake: ${query}`);
  }

  // SAFETY: every branch of the fake returns rows carrying exactly the columns
  // the matched production query selects, so the caller's Row type argument
  // always matches the rows handed back.
  return { execute: executeFakeQuery as MemorySqlExecutor['execute'] };
}

describe('pending device messages', () => {
  it('enqueues and lists a pending message', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await enqueuePendingDeviceMessage(sqlExecutor, {
      type: 'reminder',
      payload: { message: 'tomá agua' },
      nowMilliseconds: 1000,
      createIdentifier: () => 'pending-1',
    });
    const pendingList = await listPendingDeviceMessages(sqlExecutor);
    expect(pendingList).toEqual([
      {
        id: 'pending-1',
        type: 'reminder',
        payload: { message: 'tomá agua' },
      },
    ]);
  });

  it('lists pending messages in fifo order', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await enqueuePendingDeviceMessage(sqlExecutor, {
      type: 'background_result',
      payload: { summary: 'segundo' },
      nowMilliseconds: 2000,
      createIdentifier: () => 'second',
    });
    await enqueuePendingDeviceMessage(sqlExecutor, {
      type: 'reminder',
      payload: { message: 'primero' },
      nowMilliseconds: 1000,
      createIdentifier: () => 'first',
    });
    const pendingList = await listPendingDeviceMessages(sqlExecutor);
    expect(pendingList.map((message) => message.id)).toEqual(['first', 'second']);
  });

  it('deletes a pending message by id', async () => {
    const sqlExecutor = createInMemorySqlExecutor();
    await enqueuePendingDeviceMessage(sqlExecutor, {
      type: 'reminder',
      payload: { message: 'borrame' },
      createIdentifier: () => 'to-delete',
    });
    await deletePendingDeviceMessage(sqlExecutor, 'to-delete');
    expect(await listPendingDeviceMessages(sqlExecutor)).toEqual([]);
  });
});
