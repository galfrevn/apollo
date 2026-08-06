import { z } from 'zod';

import type { MemorySqlExecutor } from '@/memory/store';

export type PendingDeviceMessageType = 'background_result' | 'reminder';

const pendingDeviceMessageTypeSchema = z.enum(['background_result', 'reminder']);
const pendingDeviceMessagePayloadSchema = z.record(z.string(), z.unknown());

export async function enqueuePendingDeviceMessage(
  sqlExecutor: MemorySqlExecutor,
  input: {
    readonly type: PendingDeviceMessageType;
    readonly payload: Record<string, unknown>;
    readonly nowMilliseconds?: number;
    readonly createIdentifier?: () => string;
  },
): Promise<void> {
  const messageIdentifier = input.createIdentifier?.() ?? crypto.randomUUID();
  const createdAtMilliseconds = input.nowMilliseconds ?? Date.now();
  sqlExecutor.execute(
    'INSERT INTO pending_device_messages (id, type, payload_json, created_at) VALUES (?, ?, ?, ?)',
    messageIdentifier,
    input.type,
    JSON.stringify(input.payload),
    createdAtMilliseconds,
  );
}

export async function listPendingDeviceMessages(sqlExecutor: MemorySqlExecutor): Promise<
  readonly {
    id: string;
    type: PendingDeviceMessageType;
    payload: Record<string, unknown>;
  }[]
> {
  const rows = sqlExecutor.execute<{
    id: string;
    type: string;
    payload_json: string;
  }>(
    'SELECT id, type, payload_json FROM pending_device_messages ORDER BY created_at ASC',
  );
  return rows.map((row) => ({
    id: row.id,
    type: pendingDeviceMessageTypeSchema.parse(row.type),
    payload: pendingDeviceMessagePayloadSchema.parse(JSON.parse(row.payload_json)),
  }));
}

export async function deletePendingDeviceMessage(
  sqlExecutor: MemorySqlExecutor,
  id: string,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM pending_device_messages WHERE id = ?', id);
}
