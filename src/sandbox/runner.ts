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
  const { getSandbox } = await import('@cloudflare/sandbox');
  const sandbox = getSandbox(
    input.environment.Sandbox,
    buildApolloSandboxId(input.deviceId),
    { normalizeId: true },
  );
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
      .map((result) => {
        if ('text' in result && typeof result.text === 'string') {
          return result.text;
        }
        return '';
      })
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

export async function execCommandInApolloSandbox(input: {
  readonly environment: Env;
  readonly deviceId: string;
  readonly command: string;
}): Promise<SandboxCommandRunResult> {
  const { getSandbox } = await import('@cloudflare/sandbox');
  const sandbox = getSandbox(
    input.environment.Sandbox,
    buildApolloSandboxId(input.deviceId),
    { normalizeId: true },
  );
  const execResult = await sandbox.exec(input.command, {
    cwd: '/workspace',
    timeout: 30_000,
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
