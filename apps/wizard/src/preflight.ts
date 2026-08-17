export type WranglerAuthState = {
  readonly isLoggedIn: boolean;
  readonly accountSummary: string;
};

function runWranglerCommand(argumentList: readonly string[]): {
  readonly exitCode: number;
  readonly stdout: string;
} {
  const spawnResult = Bun.spawnSync(['bunx', 'wrangler', ...argumentList], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return { exitCode: spawnResult.exitCode, stdout: spawnResult.stdout.toString() };
}

export function inspectWranglerAuthState(): WranglerAuthState {
  const whoamiResult = runWranglerCommand(['whoami']);
  if (
    whoamiResult.exitCode !== 0 ||
    whoamiResult.stdout.includes('You are not authenticated')
  ) {
    return { isLoggedIn: false, accountSummary: '' };
  }
  const accountLineList = whoamiResult.stdout
    .split('\n')
    .filter((line) => line.includes('@') || line.includes('Account'))
    .slice(0, 4);
  return {
    isLoggedIn: true,
    accountSummary: accountLineList.join('\n').trim() || whoamiResult.stdout.trim(),
  };
}

export function runInteractiveWranglerLogin(): boolean {
  const spawnResult = Bun.spawnSync(['bunx', 'wrangler', 'login'], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  });
  return spawnResult.exitCode === 0;
}

// R2 needs a payment card on file even for free usage; probing before any
// mutation turns a mid-provision wall into an up-front instruction.
export function isR2Enabled(): boolean {
  return runWranglerCommand(['r2', 'bucket', 'list']).exitCode === 0;
}

export function runBootstrapSubcommand(
  subcommandName: string,
  extraArgumentList: readonly string[] = [],
): boolean {
  const spawnResult = Bun.spawnSync(
    ['bun', 'scripts/bootstrap.ts', subcommandName, ...extraArgumentList],
    {
      stdin: 'inherit',
      stdout: 'inherit',
      stderr: 'inherit',
    },
  );
  return spawnResult.exitCode === 0;
}
