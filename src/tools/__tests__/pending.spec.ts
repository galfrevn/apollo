import { describe, expect, it } from 'bun:test';

import { createInMemoryPendingConfirmationSqlExecutor } from '@/configuration/testing';
import {
  deletePendingToolConfirmations,
  readLatestPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';

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

    const restored = await readLatestPendingToolConfirmation(sqlExecutor);

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
    expect(await readLatestPendingToolConfirmation(sqlExecutor)).toBeUndefined();

    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-1',
      toolName: 'sandbox_exec',
      args: { command: 'ls' },
      summary: 'Ejecutar en sandbox: ls',
      expiresAt: 30_000,
    });
    await deletePendingToolConfirmations(sqlExecutor);

    expect(await readLatestPendingToolConfirmation(sqlExecutor)).toBeUndefined();
  });

  it('keeps only the newest confirmation when one replaces another', async () => {
    const sqlExecutor = createInMemoryPendingConfirmationSqlExecutor();
    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-1',
      toolName: 'sandbox_exec',
      args: { command: 'ls' },
      summary: 'primero',
      expiresAt: 10_000,
    });
    await savePendingToolConfirmation(sqlExecutor, {
      id: 'confirm-2',
      toolName: 'sandbox_exec',
      args: { command: 'pwd' },
      summary: 'segundo',
      expiresAt: 20_000,
    });

    const restored = await readLatestPendingToolConfirmation(sqlExecutor);

    expect(restored?.id).toBe('confirm-2');
    expect(restored?.summary).toBe('segundo');
  });
});
