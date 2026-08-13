import { describe, expect, it } from 'bun:test';

import {
  deleteThreadMeta,
  getThreadMeta,
  listExpiredCommandThreadSessionIds,
  listThreadMeta,
  listThreadSessionIdsActiveSince,
  markThreadFinalized,
  recordThreadActivity,
  reopenThreadMeta,
} from '@/threads/store';
import type { ThreadSqlExecutor } from '@/threads/store';

type ThreadMetaRow = {
  session_id: string;
  kind: string;
  summary: string | null;
  last_turn_at: number;
};

type ThreadSessionIdRow = {
  session_id: string;
};

function createInMemoryThreadSqlExecutor(): ThreadSqlExecutor {
  const rowMap = new Map<string, ThreadMetaRow>();
  const inMemoryExecutor = {
    execute(
      query: string,
      ...bindValues: unknown[]
    ): ReadonlyArray<ThreadMetaRow | ThreadSessionIdRow> {
      if (query.includes("VALUES (?, 'pending', NULL, ?)")) {
        const sessionId = String(bindValues[0]);
        const lastTurnAt = Number(bindValues[1]);
        const existingRow = rowMap.get(sessionId);
        if (existingRow === undefined) {
          rowMap.set(sessionId, {
            session_id: sessionId,
            kind: 'pending',
            summary: null,
            last_turn_at: lastTurnAt,
          });
        } else {
          existingRow.last_turn_at = lastTurnAt;
        }
        return [];
      }
      if (query.includes('VALUES (?, ?, ?, 0)')) {
        const sessionId = String(bindValues[0]);
        const kind = String(bindValues[1]);
        const summary = bindValues[2] === null ? null : String(bindValues[2]);
        const existingRow = rowMap.get(sessionId);
        if (existingRow === undefined) {
          rowMap.set(sessionId, {
            session_id: sessionId,
            kind,
            summary,
            last_turn_at: 0,
          });
        } else {
          existingRow.kind = kind;
          existingRow.summary = summary;
        }
        return [];
      }
      if (query.startsWith("UPDATE thread_meta SET kind = 'pending'")) {
        const targetRow = rowMap.get(String(bindValues[0]));
        if (targetRow !== undefined) {
          targetRow.kind = 'pending';
        }
        return [];
      }
      if (query.startsWith('DELETE FROM thread_meta')) {
        rowMap.delete(String(bindValues[0]));
        return [];
      }
      if (query.includes("WHERE kind = 'command'")) {
        const beforeMilliseconds = Number(bindValues[0]);
        return [...rowMap.values()]
          .filter(
            (row) =>
              row.kind === 'command' &&
              row.last_turn_at > 0 &&
              row.last_turn_at < beforeMilliseconds,
          )
          .map((row) => ({ session_id: row.session_id }));
      }
      if (query.includes('WHERE last_turn_at >=')) {
        const sinceMilliseconds = Number(bindValues[0]);
        return [...rowMap.values()]
          .filter((row) => row.last_turn_at >= sinceMilliseconds)
          .toSorted((left, right) => right.last_turn_at - left.last_turn_at)
          .map((row) => ({ session_id: row.session_id }));
      }
      if (query.includes('WHERE session_id = ? LIMIT 1')) {
        const targetRow = rowMap.get(String(bindValues[0]));
        return targetRow === undefined ? [] : [{ ...targetRow }];
      }
      return [...rowMap.values()]
        .toSorted((left, right) => right.last_turn_at - left.last_turn_at)
        .map((row) => ({ ...row }));
    },
  };
  // SAFETY: each branch of the double returns rows shaped exactly like the
  // columns the matched production query selects, so the Row type each store
  // function requests always describes the rows it receives.
  return inMemoryExecutor as ThreadSqlExecutor;
}

describe('thread meta store', () => {
  it('records activity as pending and bumps last_turn_at on repeat turns', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    recordThreadActivity(sqlExecutor, 'thread-1', 1_000);
    recordThreadActivity(sqlExecutor, 'thread-1', 2_000);

    expect(getThreadMeta(sqlExecutor, 'thread-1')).toEqual({
      sessionId: 'thread-1',
      kind: 'pending',
      summary: null,
      lastTurnAtMilliseconds: 2_000,
    });
  });

  it('keeps the finalized kind and summary when later activity lands', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    recordThreadActivity(sqlExecutor, 'thread-1', 1_000);
    markThreadFinalized(sqlExecutor, {
      sessionId: 'thread-1',
      kind: 'conversation',
      summary: 'trip planning',
    });
    recordThreadActivity(sqlExecutor, 'thread-1', 3_000);

    expect(getThreadMeta(sqlExecutor, 'thread-1')).toEqual({
      sessionId: 'thread-1',
      kind: 'conversation',
      summary: 'trip planning',
      lastTurnAtMilliseconds: 3_000,
    });
  });

  it('maps unknown kinds back to pending and misses to undefined', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    sqlExecutor.execute(
      'INSERT INTO thread_meta (session_id, kind, summary, last_turn_at) VALUES (?, ?, ?, 0)',
      'thread-odd',
      'archived',
      null,
    );

    expect(getThreadMeta(sqlExecutor, 'thread-odd')?.kind).toBe('pending');
    expect(getThreadMeta(sqlExecutor, 'thread-missing')).toBeUndefined();
  });

  it('lists meta newest-first and reopens finalized threads to pending', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    recordThreadActivity(sqlExecutor, 'thread-old', 1_000);
    recordThreadActivity(sqlExecutor, 'thread-new', 5_000);
    markThreadFinalized(sqlExecutor, {
      sessionId: 'thread-old',
      kind: 'command',
      summary: null,
    });

    expect(listThreadMeta(sqlExecutor).map((record) => record.sessionId)).toEqual([
      'thread-new',
      'thread-old',
    ]);

    reopenThreadMeta(sqlExecutor, 'thread-old');
    expect(getThreadMeta(sqlExecutor, 'thread-old')?.kind).toBe('pending');
  });

  it('lists expired command threads and deletes their meta', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    recordThreadActivity(sqlExecutor, 'thread-command', 1_000);
    markThreadFinalized(sqlExecutor, {
      sessionId: 'thread-command',
      kind: 'command',
      summary: null,
    });
    recordThreadActivity(sqlExecutor, 'thread-command', 1_500);
    recordThreadActivity(sqlExecutor, 'thread-conversation', 1_500);

    expect(listExpiredCommandThreadSessionIds(sqlExecutor, 2_000)).toEqual([
      'thread-command',
    ]);
    expect(listExpiredCommandThreadSessionIds(sqlExecutor, 1_000)).toEqual([]);

    deleteThreadMeta(sqlExecutor, 'thread-command');
    expect(getThreadMeta(sqlExecutor, 'thread-command')).toBeUndefined();
  });

  it('lists sessions active since a cutoff, newest first', () => {
    const sqlExecutor = createInMemoryThreadSqlExecutor();
    recordThreadActivity(sqlExecutor, 'thread-a', 1_000);
    recordThreadActivity(sqlExecutor, 'thread-b', 3_000);
    recordThreadActivity(sqlExecutor, 'thread-c', 2_000);

    expect(listThreadSessionIdsActiveSince(sqlExecutor, 2_000)).toEqual([
      'thread-b',
      'thread-c',
    ]);
  });
});
