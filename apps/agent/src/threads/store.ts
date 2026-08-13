export type ThreadSqlExecutor = {
  execute<Row extends Record<string, unknown>>(
    query: string,
    ...bindValues: unknown[]
  ): readonly Row[];
};

export type ThreadKind = 'pending' | 'command' | 'conversation';

export type ThreadMetaRecord = {
  readonly sessionId: string;
  readonly kind: ThreadKind;
  readonly summary: string | null;
  readonly lastTurnAtMilliseconds: number;
};

type ThreadMetaRow = {
  readonly session_id: string;
  readonly kind: string;
  readonly summary: string | null;
  readonly last_turn_at: number;
};

function mapRowToThreadMetaRecord(row: ThreadMetaRow): ThreadMetaRecord {
  return {
    sessionId: row.session_id,
    kind: row.kind === 'command' || row.kind === 'conversation' ? row.kind : 'pending',
    summary: row.summary,
    lastTurnAtMilliseconds: row.last_turn_at,
  };
}

export function recordThreadActivity(
  sqlExecutor: ThreadSqlExecutor,
  sessionId: string,
  nowMilliseconds: number,
): void {
  sqlExecutor.execute(
    `INSERT INTO thread_meta (session_id, kind, summary, last_turn_at)
     VALUES (?, 'pending', NULL, ?)
     ON CONFLICT(session_id) DO UPDATE SET last_turn_at = excluded.last_turn_at`,
    sessionId,
    nowMilliseconds,
  );
}

export function markThreadFinalized(
  sqlExecutor: ThreadSqlExecutor,
  input: {
    readonly sessionId: string;
    readonly kind: Exclude<ThreadKind, 'pending'>;
    readonly summary: string | null;
  },
): void {
  sqlExecutor.execute(
    `INSERT INTO thread_meta (session_id, kind, summary, last_turn_at)
     VALUES (?, ?, ?, 0)
     ON CONFLICT(session_id) DO UPDATE SET kind = excluded.kind, summary = excluded.summary`,
    input.sessionId,
    input.kind,
    input.summary,
  );
}

export function getThreadMeta(
  sqlExecutor: ThreadSqlExecutor,
  sessionId: string,
): ThreadMetaRecord | undefined {
  const rows = sqlExecutor.execute<ThreadMetaRow>(
    'SELECT session_id, kind, summary, last_turn_at FROM thread_meta WHERE session_id = ? LIMIT 1',
    sessionId,
  );
  return rows[0] === undefined ? undefined : mapRowToThreadMetaRecord(rows[0]);
}

export function listThreadMeta(
  sqlExecutor: ThreadSqlExecutor,
): readonly ThreadMetaRecord[] {
  const rows = sqlExecutor.execute<ThreadMetaRow>(
    'SELECT session_id, kind, summary, last_turn_at FROM thread_meta ORDER BY last_turn_at DESC',
  );
  return rows.map(mapRowToThreadMetaRecord);
}

export function reopenThreadMeta(
  sqlExecutor: ThreadSqlExecutor,
  sessionId: string,
): void {
  sqlExecutor.execute(
    "UPDATE thread_meta SET kind = 'pending' WHERE session_id = ?",
    sessionId,
  );
}

export function listExpiredCommandThreadSessionIds(
  sqlExecutor: ThreadSqlExecutor,
  beforeMilliseconds: number,
): readonly string[] {
  const rows = sqlExecutor.execute<{ session_id: string }>(
    "SELECT session_id FROM thread_meta WHERE kind = 'command' AND last_turn_at > 0 AND last_turn_at < ?",
    beforeMilliseconds,
  );
  return rows.map((row) => row.session_id);
}

export function deleteThreadMeta(
  sqlExecutor: ThreadSqlExecutor,
  sessionId: string,
): void {
  sqlExecutor.execute('DELETE FROM thread_meta WHERE session_id = ?', sessionId);
}

export function listThreadSessionIdsActiveSince(
  sqlExecutor: ThreadSqlExecutor,
  sinceMilliseconds: number,
): readonly string[] {
  const rows = sqlExecutor.execute<{ session_id: string }>(
    'SELECT session_id FROM thread_meta WHERE last_turn_at >= ? ORDER BY last_turn_at DESC',
    sinceMilliseconds,
  );
  return rows.map((row) => row.session_id);
}
