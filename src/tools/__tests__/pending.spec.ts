import { describe, expect, it } from 'bun:test';

import { createInMemoryPendingConfirmationSqlExecutor } from '@/configuration/testing';
import type { MemorySqlExecutor } from '@/memory/store';
import {
  deletePendingToolConfirmations,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';

function createSingleRowSqlExecutor(row: Record<string, unknown>): MemorySqlExecutor {
  const rowList: readonly Record<string, unknown>[] = [row];
  return {
    execute: <Row extends Record<string, unknown>>(query: string): readonly Row[] =>
      query.includes('FROM pending_confirmations') ? (rowList as readonly Row[]) : [],
  };
}

describe('pending tool confirmation store', () => {
  it('round-trips a confirmation with its arguments intact', async () => {
    const sqlExecutor = createInMemoryPendingConfirmationSqlExecutor();
    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-1',
      toolName: 'sandbox_run_code',
      args: { code: 'print(2 + 2)', language: 'python' },
      summary: 'Ejecutar código python en sandbox',
      expiresAt: 30_000,
    });

    const restored = await readPendingToolConfirmation(sqlExecutor);

    expect(restored).toEqual({
      id: 'confirm-1',
      toolName: 'sandbox_run_code',
      args: { code: 'print(2 + 2)', language: 'python' },
      summary: 'Ejecutar código python en sandbox',
      expiresAt: 30_000,
    });
  });

  it('reports nothing pending on an empty store and after a delete', async () => {
    const sqlExecutor = createInMemoryPendingConfirmationSqlExecutor();
    expect(await readPendingToolConfirmation(sqlExecutor)).toBeUndefined();

    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-1',
      toolName: 'sandbox_exec',
      args: { command: 'ls' },
      summary: 'Ejecutar en sandbox: ls',
      expiresAt: 30_000,
    });
    await deletePendingToolConfirmations(sqlExecutor);

    expect(await readPendingToolConfirmation(sqlExecutor)).toBeUndefined();
  });

  it('replaces the previous confirmation rather than accumulating rows', async () => {
    const sqlExecutor = createInMemoryPendingConfirmationSqlExecutor();
    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-1',
      toolName: 'sandbox_exec',
      args: { command: 'ls' },
      summary: 'primero',
      expiresAt: 20_000,
    });
    // Deliberately shorter-lived than the row it supersedes: ordering must not
    // decide which confirmation is restored, replacement must.
    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-2',
      toolName: 'sandbox_exec',
      args: { command: 'pwd' },
      summary: 'segundo',
      expiresAt: 10_000,
    });

    const restored = await readPendingToolConfirmation(sqlExecutor);

    expect(restored?.id).toBe('confirm-2');
    expect(restored?.args).toEqual({ command: 'pwd' });

    await deletePendingToolConfirmations(sqlExecutor);
    expect(await readPendingToolConfirmation(sqlExecutor)).toBeUndefined();
  });

  it('treats a row it cannot read back as nothing pending', async () => {
    const corruptRowSqlExecutor = createSingleRowSqlExecutor({
      id: 'confirm-1',
      tool_name: 'sandbox_exec',
      args_json: '{not json',
      summary: 'roto',
      expires_at: 30_000,
    });

    expect(await readPendingToolConfirmation(corruptRowSqlExecutor)).toBeUndefined();
  });

  it('treats a row of the wrong shape as nothing pending', async () => {
    const wrongShapeSqlExecutor = createSingleRowSqlExecutor({
      id: 'confirm-1',
      summary: 'incompleto',
    });

    expect(await readPendingToolConfirmation(wrongShapeSqlExecutor)).toBeUndefined();
  });
});
