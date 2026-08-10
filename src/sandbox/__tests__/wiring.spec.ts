import { describe, expect, it, mock } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createInMemoryPendingConfirmationSqlExecutor,
} from '@/configuration/testing';
import { DEFAULT_SANDBOX_COMMAND_TIMEOUT_MILLISECONDS } from '@/sandbox/runner';
import {
  deletePendingToolConfirmations,
  readPendingToolConfirmation,
  savePendingToolConfirmation,
} from '@/tools/pending';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import { executeToolByName, resolvePendingToolConfirmation } from '@/tools/router';

type CapturedSandboxCall = {
  readonly sandboxId: string;
  readonly code?: string;
  readonly command?: string;
  readonly timeoutMilliseconds?: number;
};

const capturedSandboxCallList: CapturedSandboxCall[] = [];

mock.module('@cloudflare/sandbox', () => ({
  getSandbox: (_namespace: unknown, sandboxId: string) => ({
    createCodeContext: async () => ({ id: 'context-1' }),
    runCode: async (code: string) => {
      capturedSandboxCallList.push({ sandboxId, code });
      return {
        logs: { stdout: ['4'], stderr: [] },
        results: [],
        error: undefined,
      };
    },
    exec: async (command: string, options?: { timeout?: number }) => {
      capturedSandboxCallList.push({
        sandboxId,
        command,
        ...(options?.timeout !== undefined
          ? { timeoutMilliseconds: options.timeout }
          : {}),
      });
      return {
        success: true,
        exitCode: 0,
        stdout: 'workspace\n',
        stderr: '',
      };
    },
  }),
}));

const fakeEnvironment = createFakeApolloEnvironment();

describe('sandbox end-to-end wiring', () => {
  it('routes a sandbox call through confirmation, hibernation, and execution', async () => {
    capturedSandboxCallList.length = 0;
    const toolDefinitionMap = createBuiltinToolDefinitionMap();
    const sqlExecutor = createInMemoryPendingConfirmationSqlExecutor();

    const outcome = await executeToolByName(
      toolDefinitionMap,
      'sandbox_run_code',
      { code: 'print(2 + 2)', language: 'python' },
      { environment: fakeEnvironment, nowMilliseconds: 0, deviceId: 'desk-01' },
      () => 'confirm-1',
    );

    expect(outcome.status).toBe('needs_confirm');
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected the sandbox tool to require confirmation');
    }
    expect(outcome.pending.summary).toBe('Ejecutar código python en sandbox');
    expect(capturedSandboxCallList).toHaveLength(0);

    await savePendingToolConfirmation(sqlExecutor, outcome.pending);

    // Everything the agent held in memory is gone, as after a hibernation.
    const restoredConfirmation = await readPendingToolConfirmation(sqlExecutor);
    expect(restoredConfirmation).toBeDefined();
    if (restoredConfirmation === undefined) {
      throw new Error('expected the confirmation to survive hibernation');
    }

    const result = await resolvePendingToolConfirmation(
      createBuiltinToolDefinitionMap(),
      restoredConfirmation,
      true,
      { environment: fakeEnvironment, nowMilliseconds: 1000, deviceId: 'desk-01' },
    );

    expect('cancelled' in result).toBe(false);
    if ('cancelled' in result) {
      throw new Error('expected the confirmed tool to run');
    }
    expect(result.ok).toBe(true);
    expect(result.summary).toBe('4');
    expect(capturedSandboxCallList).toEqual([
      { sandboxId: 'apollo-desk-01', code: 'print(2 + 2)' },
    ]);

    await deletePendingToolConfirmations(sqlExecutor);
    expect(await readPendingToolConfirmation(sqlExecutor)).toBeUndefined();
  });

  it('executes a confirmed command with the default timeout', async () => {
    capturedSandboxCallList.length = 0;
    const outcome = await executeToolByName(
      createBuiltinToolDefinitionMap(),
      'sandbox_exec',
      { command: 'ls /workspace' },
      { environment: fakeEnvironment, nowMilliseconds: 0, deviceId: 'desk-01' },
      () => 'confirm-4',
    );
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected sandbox_exec to require confirmation');
    }

    const result = await resolvePendingToolConfirmation(
      createBuiltinToolDefinitionMap(),
      outcome.pending,
      true,
      { environment: fakeEnvironment, nowMilliseconds: 1000, deviceId: 'desk-01' },
    );

    if ('cancelled' in result) {
      throw new Error('expected the confirmed command to run');
    }
    expect(result.ok).toBe(true);
    expect(capturedSandboxCallList).toEqual([
      {
        sandboxId: 'apollo-desk-01',
        command: 'ls /workspace',
        timeoutMilliseconds: DEFAULT_SANDBOX_COMMAND_TIMEOUT_MILLISECONDS,
      },
    ]);
  });

  it('never reaches the container when the user declines', async () => {
    capturedSandboxCallList.length = 0;
    const outcome = await executeToolByName(
      createBuiltinToolDefinitionMap(),
      'sandbox_exec',
      { command: 'ls /workspace' },
      { environment: fakeEnvironment, nowMilliseconds: 0, deviceId: 'desk-01' },
      () => 'confirm-2',
    );
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected sandbox_exec to require confirmation');
    }

    const result = await resolvePendingToolConfirmation(
      createBuiltinToolDefinitionMap(),
      outcome.pending,
      false,
      { environment: fakeEnvironment, nowMilliseconds: 1000, deviceId: 'desk-01' },
    );

    expect(result).toEqual({ cancelled: true });
    expect(capturedSandboxCallList).toHaveLength(0);
  });

  it('refuses a confirmation that outlived its window', async () => {
    capturedSandboxCallList.length = 0;
    const outcome = await executeToolByName(
      createBuiltinToolDefinitionMap(),
      'sandbox_exec',
      { command: 'rm -rf /workspace' },
      { environment: fakeEnvironment, nowMilliseconds: 0, deviceId: 'desk-01' },
      () => 'confirm-3',
    );
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected sandbox_exec to require confirmation');
    }

    const result = await resolvePendingToolConfirmation(
      createBuiltinToolDefinitionMap(),
      outcome.pending,
      true,
      {
        environment: fakeEnvironment,
        nowMilliseconds: outcome.pending.expiresAt + 1,
        deviceId: 'desk-01',
      },
    );

    expect(result).toEqual({ cancelled: true });
    expect(capturedSandboxCallList).toHaveLength(0);
  });
});
