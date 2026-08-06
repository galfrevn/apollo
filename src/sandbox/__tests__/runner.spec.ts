import { describe, expect, it } from 'bun:test';

import { buildApolloSandboxId, formatSandboxCodeSummary } from '@/sandbox/helpers';
import { sandboxExecTool, sandboxRunCodeTool } from '@/tools/sandbox';

describe('sandbox helpers', () => {
  it('builds a normalized sandbox id per device', () => {
    expect(buildApolloSandboxId(' Desk-01 ')).toBe('apollo-desk-01');
    expect(buildApolloSandboxId('')).toBe('apollo-default');
  });

  it('summarizes stdout, stderr, and errors', () => {
    expect(
      formatSandboxCodeSummary({
        language: 'python',
        stdout: '  42\n',
        stderr: '',
      }),
    ).toBe('42');

    expect(
      formatSandboxCodeSummary({
        language: 'javascript',
        stdout: '',
        stderr: 'warn',
      }),
    ).toBe('warn');

    expect(
      formatSandboxCodeSummary({
        language: 'typescript',
        stdout: '',
        stderr: '',
        errorName: 'SyntaxError',
        errorValue: 'unexpected token',
      }),
    ).toBe('Sandbox typescript error: SyntaxError: unexpected token');

    expect(
      formatSandboxCodeSummary({
        language: 'python',
        stdout: '',
        stderr: '',
      }),
    ).toBe('Sandbox python: sin salida');
  });

  it('exposes safe run_code and unsafe exec tools', () => {
    expect(sandboxRunCodeTool.name).toBe('sandbox_run_code');
    expect(sandboxRunCodeTool.safety).toBe('safe');
    expect(sandboxExecTool.name).toBe('sandbox_exec');
    expect(sandboxExecTool.safety).toBe('unsafe');
    expect(
      sandboxExecTool.buildConfirmSummary?.({
        command: 'ls /workspace',
      }),
    ).toBe('Ejecutar en sandbox: ls /workspace');
  });
});
