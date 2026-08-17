export type CommandResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

export function runWrangler(
  argumentList: readonly string[],
  standardInputText?: string,
): CommandResult {
  const spawnResult = Bun.spawnSync(['bunx', 'wrangler', ...argumentList], {
    stdin:
      standardInputText === undefined
        ? 'ignore'
        : new TextEncoder().encode(standardInputText),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: spawnResult.exitCode,
    stdout: spawnResult.stdout.toString(),
    stderr: spawnResult.stderr.toString(),
  };
}

export function runDocker(argumentList: readonly string[]): CommandResult {
  const spawnResult = Bun.spawnSync(['docker', ...argumentList], {
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: spawnResult.exitCode,
    stdout: spawnResult.stdout.toString(),
    stderr: spawnResult.stderr.toString(),
  };
}

export function reportStep(stepLabel: string, isOk: boolean, detail?: string): void {
  const marker = isOk ? 'ok' : 'FAIL';
  console.log(`[${marker}] ${stepLabel}${detail ? ` — ${detail}` : ''}`);
  if (!isOk) {
    process.exitCode = 1;
  }
}
