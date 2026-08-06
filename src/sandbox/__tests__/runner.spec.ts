import { describe, expect, it } from 'bun:test';

import {
  buildApolloSandboxId,
  formatSandboxCodeSummary,
  MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS,
  truncateSandboxOutputForToolResult,
} from '@/sandbox/helpers';
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

  it('leaves short output untouched and truncates long output', () => {
    expect(truncateSandboxOutputForToolResult('short output')).toBe('short output');

    const longOutput = 'x'.repeat(MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS + 500);
    const truncated = truncateSandboxOutputForToolResult(longOutput);
    expect(
      truncated.startsWith('x'.repeat(MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS)),
    ).toBe(true);
    expect(truncated.endsWith('… (truncado)')).toBe(true);
    expect(truncated.length).toBeLessThan(longOutput.length);
  });

  it('exposes unsafe run_code and exec tools that both require confirmation', () => {
    expect(sandboxRunCodeTool.name).toBe('sandbox_run_code');
    expect(sandboxRunCodeTool.safety).toBe('unsafe');
    expect(
      sandboxRunCodeTool.buildConfirmSummary?.({
        code: 'print(42)',
        language: 'python',
      }),
    ).toBe('Ejecutar código python en sandbox');
    expect(sandboxExecTool.name).toBe('sandbox_exec');
    expect(sandboxExecTool.safety).toBe('unsafe');
    expect(
      sandboxExecTool.buildConfirmSummary?.({
        command: 'ls /workspace',
      }),
    ).toBe('Ejecutar en sandbox: ls /workspace');
  });
});
