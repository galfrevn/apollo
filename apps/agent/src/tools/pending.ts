import { z } from 'zod';

import type { MemorySqlExecutor } from '@/memory/store';
import {
  jsonSerializableValueSchema,
  type JsonSerializableValue,
  type PendingToolConfirmation,
} from '@/tools/types';

const pendingToolConfirmationRowSchema = z.object({
  id: z.string().min(1),
  tool_name: z.string().min(1),
  args_json: z.string(),
  summary: z.string().min(1),
  expires_at: z.number().int().nonnegative(),
});

// The agent tracks a single pending confirmation, so the table holds at most
// one row: replacing rather than upserting keeps a superseded confirmation from
// being restored in place of the live one.
export async function savePendingToolConfirmation(
  sqlExecutor: MemorySqlExecutor,
  confirmation: PendingToolConfirmation,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM pending_confirmations');
  sqlExecutor.execute(
    'INSERT INTO pending_confirmations (id, tool_name, args_json, summary, expires_at) VALUES (?, ?, ?, ?, ?)',
    confirmation.id,
    confirmation.toolName,
    JSON.stringify(confirmation.args ?? null),
    confirmation.summary,
    confirmation.expiresAt,
  );
}

export async function readPendingToolConfirmation(
  sqlExecutor: MemorySqlExecutor,
): Promise<PendingToolConfirmation | undefined> {
  const rows = sqlExecutor.execute(
    'SELECT id, tool_name, args_json, summary, expires_at FROM pending_confirmations LIMIT 1',
  );
  const firstRow = rows[0];
  if (firstRow === undefined) {
    return undefined;
  }

  // A row that cannot be read back is treated as nothing pending: the caller
  // would otherwise hand unvalidated arguments to an unsafe tool.
  const parsedRow = pendingToolConfirmationRowSchema.safeParse(firstRow);
  if (!parsedRow.success) {
    return undefined;
  }
  let storedArguments: JsonSerializableValue;
  try {
    storedArguments = jsonSerializableValueSchema.parse(
      JSON.parse(parsedRow.data.args_json),
    );
  } catch {
    return undefined;
  }

  return {
    id: parsedRow.data.id,
    toolName: parsedRow.data.tool_name,
    args: storedArguments,
    summary: parsedRow.data.summary,
    expiresAt: parsedRow.data.expires_at,
  };
}

export async function deletePendingToolConfirmations(
  sqlExecutor: MemorySqlExecutor,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM pending_confirmations');
}

// A confirm answer that restores nothing is one of two different situations. A
// stray tap with no confirmation pending is noise and stays ignored; agent
// state that still names a confirmation means the device is showing a confirm
// screen the server can no longer resolve — reading the row back failed, or the
// state outlived it. That one has to be closed out, or the answer is swallowed
// and the screen stays up until the expiry timer fires.
export function isPendingConfirmationOrphaned(input: {
  readonly restoredConfirmation: PendingToolConfirmation | undefined;
  readonly pendingConfirmIdInState: string | null;
}): boolean {
  return (
    input.restoredConfirmation === undefined && input.pendingConfirmIdInState !== null
  );
}
