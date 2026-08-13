import { SANDBOX_UNAVAILABLE_SPOKEN_SUMMARY } from '@/sandbox/capability';
import {
  buildApolloSandboxId,
  formatSandboxCodeSummary,
  type SandboxCodeLanguage,
} from '@/sandbox/helpers';

export type SandboxCodeRunResult = {
  readonly ok: boolean;
  readonly summary: string;
  readonly stdout: string;
  readonly stderr: string;
};

export type SandboxCommandRunResult = {
  readonly ok: boolean;
  readonly summary: string;
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export async function runCodeInApolloSandbox(input: {
  readonly environment: Env;
  readonly deviceId: string;
  readonly code: string;
  readonly language: SandboxCodeLanguage;
}): Promise<SandboxCodeRunResult> {
  const sandboxNamespace = input.environment.Sandbox;
  if (sandboxNamespace === undefined) {
    return {
      ok: false,
      summary: SANDBOX_UNAVAILABLE_SPOKEN_SUMMARY,
      stdout: '',
      stderr: '',
    };
  }
  const { getSandbox } = await import('@cloudflare/sandbox');
  const sandbox = getSandbox(sandboxNamespace, buildApolloSandboxId(input.deviceId), {
    normalizeId: true,
  });
  const codeContext = await sandbox.createCodeContext({
    language: input.language,
  });
  const executionResult = await sandbox.runCode(input.code, {
    context: codeContext,
    language: input.language,
  });

  const stdout = [
    ...(executionResult.logs?.stdout ?? []),
    ...executionResult.results
      .map((result) => result.text ?? '')
      .filter((text) => text.length > 0),
  ].join('\n');
  const stderr = (executionResult.logs?.stderr ?? []).join('\n');
  const summary = formatSandboxCodeSummary({
    language: input.language,
    stdout,
    stderr,
    errorName: executionResult.error?.name,
    errorValue: executionResult.error?.message,
  });

  return {
    ok: executionResult.error === undefined,
    summary,
    stdout,
    stderr,
  };
}

export const DEFAULT_SANDBOX_COMMAND_TIMEOUT_MILLISECONDS = 30_000;

export async function execCommandInApolloSandbox(input: {
  readonly environment: Env;
  readonly deviceId: string;
  readonly command: string;
  readonly timeoutMilliseconds?: number;
}): Promise<SandboxCommandRunResult> {
  const sandboxNamespace = input.environment.Sandbox;
  if (sandboxNamespace === undefined) {
    return {
      ok: false,
      summary: SANDBOX_UNAVAILABLE_SPOKEN_SUMMARY,
      stdout: '',
      stderr: '',
      exitCode: 1,
    };
  }
  const { getSandbox } = await import('@cloudflare/sandbox');
  const sandbox = getSandbox(sandboxNamespace, buildApolloSandboxId(input.deviceId), {
    normalizeId: true,
  });
  const execResult = await sandbox.exec(input.command, {
    cwd: '/workspace',
    timeout: input.timeoutMilliseconds ?? DEFAULT_SANDBOX_COMMAND_TIMEOUT_MILLISECONDS,
  });

  const summary = execResult.success
    ? execResult.stdout.trim().slice(0, 1200) ||
      `Comando OK (exit ${execResult.exitCode})`
    : `Comando falló (exit ${execResult.exitCode}): ${execResult.stderr.trim().slice(0, 800)}`;

  return {
    ok: execResult.success,
    summary,
    stdout: execResult.stdout,
    stderr: execResult.stderr,
    exitCode: execResult.exitCode,
  };
}
