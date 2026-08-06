import { z } from 'zod';

import {
  truncateSandboxOutputForToolResult,
  type SandboxCodeLanguage,
} from '@/sandbox/helpers';
import type { ToolDefinition } from '@/tools/types';

const sandboxRunCodeArgsSchema = z.object({
  code: z.string().min(1).max(20_000),
  language: z.enum(['python', 'javascript', 'typescript']).default('python'),
});

const sandboxExecArgsSchema = z.object({
  command: z.string().min(1).max(2000),
});

export const sandboxRunCodeTool: ToolDefinition = {
  name: 'sandbox_run_code',
  safety: 'unsafe',
  description:
    'Ejecuta código en un sandbox aislado de Cloudflare (python/javascript/typescript, requiere confirmación)',
  parameters: {
    type: 'object',
    properties: {
      code: { type: 'string' },
      language: {
        type: 'string',
        enum: ['python', 'javascript', 'typescript'],
      },
    },
    required: ['code'],
    additionalProperties: false,
  },
  buildConfirmSummary(args) {
    const parsedArgs = sandboxRunCodeArgsSchema.parse(args);
    return `Ejecutar código ${parsedArgs.language} en sandbox`;
  },
  async handler(args, context) {
    const { runCodeInApolloSandbox } = await import('@/sandbox/runner');
    const parsedArgs = sandboxRunCodeArgsSchema.parse(args);
    const deviceId = context.deviceId ?? 'default';
    const result = await runCodeInApolloSandbox({
      environment: context.environment,
      deviceId,
      code: parsedArgs.code,
      language: parsedArgs.language as SandboxCodeLanguage,
    });
    return {
      ok: result.ok,
      summary: result.summary,
      data: {
        stdout: truncateSandboxOutputForToolResult(result.stdout),
        stderr: truncateSandboxOutputForToolResult(result.stderr),
      },
    };
  },
};

export const sandboxExecTool: ToolDefinition = {
  name: 'sandbox_exec',
  safety: 'unsafe',
  description: 'Ejecuta un comando de shell en el sandbox (requiere confirmación)',
  parameters: {
    type: 'object',
    properties: { command: { type: 'string' } },
    required: ['command'],
    additionalProperties: false,
  },
  buildConfirmSummary(args) {
    const parsedArgs = sandboxExecArgsSchema.parse(args);
    return `Ejecutar en sandbox: ${parsedArgs.command}`;
  },
  async handler(args, context) {
    const { execCommandInApolloSandbox } = await import('@/sandbox/runner');
    const parsedArgs = sandboxExecArgsSchema.parse(args);
    const deviceId = context.deviceId ?? 'default';
    const result = await execCommandInApolloSandbox({
      environment: context.environment,
      deviceId,
      command: parsedArgs.command,
    });
    return {
      ok: result.ok,
      summary: result.summary,
      data: {
        stdout: truncateSandboxOutputForToolResult(result.stdout),
        stderr: truncateSandboxOutputForToolResult(result.stderr),
        exitCode: result.exitCode,
      },
    };
  },
};
