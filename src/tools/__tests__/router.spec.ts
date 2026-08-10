import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import {
  buildToolDefinitionMap,
  executeToolByName,
  resolvePendingToolConfirmation,
} from '@/tools/router';
import type { ToolDefinition } from '@/tools/types';

const fakeEnvironment = createFakeApolloEnvironment();

describe('tool router', () => {
  const safeTool: ToolDefinition = {
    name: 'memory_add',
    safety: 'safe',
    description: 'safe',
    parameters: { type: 'object', properties: {} },
    async handler() {
      return { ok: true, summary: 'guardado' };
    },
  };

  const unsafeTool: ToolDefinition = {
    name: 'shell_exec_test',
    safety: 'unsafe',
    description: 'unsafe',
    parameters: { type: 'object', properties: {} },
    buildConfirmSummary: () => 'Ejecutar shell',
    async handler() {
      return { ok: true, summary: 'ejecutado' };
    },
  };

  // Mirrors the real unsafe tools: the summary builder parses the arguments
  // with the tool's schema, so bad arguments throw before a confirmation exists.
  const strictUnsafeTool: ToolDefinition = {
    name: 'strict_exec_test',
    safety: 'unsafe',
    description: 'unsafe',
    parameters: { type: 'object', properties: {} },
    buildConfirmSummary: (args) => {
      const parsed = z.object({ command: z.string().min(1) }).parse(args);
      return `Ejecutar ${parsed.command}`;
    },
    async handler() {
      return { ok: true, summary: 'ejecutado' };
    },
  };

  const toolDefinitionMap = buildToolDefinitionMap([
    safeTool,
    unsafeTool,
    strictUnsafeTool,
  ]);

  it('runs safe tool immediately', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'memory_add',
      {},
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
    );
    expect(outcome.status).toBe('done');
    if (outcome.status === 'done') {
      expect(outcome.result.summary).toBe('guardado');
    }
  });

  it('rejects arguments the unsafe tool cannot accept without creating a confirmation', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'strict_exec_test',
      { command: '' },
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
    );
    // A tool error the turn can speak and retry, not an exception that sinks it
    // — and nothing to persist, so the confirm screen never opens.
    expect(outcome.status).toBe('done');
    if (outcome.status === 'done') {
      expect(outcome.result.ok).toBe(false);
      expect(outcome.result.summary).toContain('argumentos inválidos');
    }
  });

  it('still confirms when the unsafe tool accepts the arguments', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'strict_exec_test',
      { command: 'ls' },
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
      () => 'confirm-strict',
    );
    expect(outcome.status).toBe('needs_confirm');
    if (outcome.status === 'needs_confirm') {
      expect(outcome.pending.summary).toBe('Ejecutar ls');
    }
  });

  it('returns needs_confirm for unsafe tool', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'shell_exec_test',
      { command: 'ls' },
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
      () => 'confirm-1',
    );
    expect(outcome.status).toBe('needs_confirm');
    if (outcome.status === 'needs_confirm') {
      expect(outcome.pending.id).toBe('confirm-1');
      expect(outcome.pending.expiresAt).toBe(31_000);
    }
  });

  it('cancels confirm on reject', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'shell_exec_test',
      {},
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
      () => 'confirm-1',
    );
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected needs_confirm');
    }
    const resolved = await resolvePendingToolConfirmation(
      toolDefinitionMap,
      outcome.pending,
      false,
      { environment: fakeEnvironment, nowMilliseconds: 2000 },
    );
    expect(resolved).toEqual({ cancelled: true });
  });

  it('executes after confirm ok', async () => {
    const outcome = await executeToolByName(
      toolDefinitionMap,
      'shell_exec_test',
      {},
      { environment: fakeEnvironment, nowMilliseconds: 1000 },
      () => 'confirm-1',
    );
    if (outcome.status !== 'needs_confirm') {
      throw new Error('expected needs_confirm');
    }
    const resolved = await resolvePendingToolConfirmation(
      toolDefinitionMap,
      outcome.pending,
      true,
      { environment: fakeEnvironment, nowMilliseconds: 2000 },
    );
    expect(resolved).toMatchObject({ ok: true, summary: 'ejecutado' });
  });
});
