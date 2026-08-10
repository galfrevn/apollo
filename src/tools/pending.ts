import { z } from 'zod';

import type { MemorySqlExecutor } from '@/memory/store';
import type { PendingToolConfirmation } from '@/tools/types';

const pendingToolConfirmationRowSchema = z.object({
  id: z.string().min(1),
  tool_name: z.string().min(1),
  args_json: z.string(),
  summary: z.string().min(1),
  expires_at: z.number().int().nonnegative(),
});

export async function savePendingToolConfirmation(
  sqlExecutor: MemorySqlExecutor,
  confirmation: PendingToolConfirmation,
): Promise<void> {
  sqlExecutor.execute(
    'INSERT INTO pending_confirmations (id, tool_name, args_json, summary, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET tool_name = excluded.tool_name, args_json = excluded.args_json, summary = excluded.summary, expires_at = excluded.expires_at',
    confirmation.id,
    confirmation.toolName,
    JSON.stringify(confirmation.args ?? null),
    confirmation.summary,
    confirmation.expiresAt,
  );
}

export async function readLatestPendingToolConfirmation(
  sqlExecutor: MemorySqlExecutor,
): Promise<PendingToolConfirmation | undefined> {
  const rows = sqlExecutor.execute<Record<string, unknown>>(
    'SELECT id, tool_name, args_json, summary, expires_at FROM pending_confirmations ORDER BY expires_at DESC LIMIT 1',
  );
  const firstRow = rows[0];
  if (firstRow === undefined) {
    return undefined;
  }
  const parsedRow = pendingToolConfirmationRowSchema.parse(firstRow);
  return {
    id: parsedRow.id,
    toolName: parsedRow.tool_name,
    args: JSON.parse(parsedRow.args_json),
    summary: parsedRow.summary,
    expiresAt: parsedRow.expires_at,
  };
}

export async function deletePendingToolConfirmations(
  sqlExecutor: MemorySqlExecutor,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM pending_confirmations');
}
