import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCreateCommandArgumentList, scaffoldStarterProject } from '@/scaffold';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const templateDirectory = join(scriptDirectory, '..', 'template');
const setupBundlePath = join(scriptDirectory, 'setup.js');

function isCommandAvailable(commandName: string): boolean {
  return spawnSync(commandName, ['--version'], { stdio: 'ignore' }).status === 0;
}

function runInTarget(
  commandArgumentList: readonly string[],
  targetDirectory: string,
): boolean {
  const spawnResult = spawnSync(commandArgumentList[0], commandArgumentList.slice(1), {
    cwd: targetDirectory,
    stdio: 'inherit',
  });
  return spawnResult.status === 0;
}

const argumentList = process.argv.slice(2);

// `bun run setup` inside a scaffolded project delegates here: the wizard ships
// bundled in this package, never copied into the scaffold.
if (argumentList[0] === 'setup') {
  if (!isCommandAvailable('bun')) {
    console.error('Apollo setup runs on Bun — install it first: https://bun.sh');
    process.exit(1);
  }
  const didSetupSucceed = runInTarget(['bun', setupBundlePath], process.cwd());
  process.exit(didSetupSucceed ? 0 : 1);
}

const optionSet = parseCreateCommandArgumentList(argumentList);
const targetDirectory = resolve(process.cwd(), optionSet.targetDirectoryName);

console.log(`\ncreate-heyapollo — scaffolding into ${optionSet.targetDirectoryName}/`);
try {
  scaffoldStarterProject({ templateDirectory, targetDirectory });
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

if (optionSet.shouldInitializeGit && isCommandAvailable('git')) {
  runInTarget(['git', 'init', '--initial-branch=main'], targetDirectory);
}

if (!isCommandAvailable('bun')) {
  console.log(
    [
      '',
      'Apollo runs on Bun, which is not installed yet.',
      '  1. Install it: https://bun.sh',
      `  2. cd ${optionSet.targetDirectoryName}`,
      '  3. bun install',
      '  4. bun run setup   (the interactive wizard)',
    ].join('\n'),
  );
  process.exit(0);
}

if (optionSet.shouldInstall && !runInTarget(['bun', 'install'], targetDirectory)) {
  console.error(
    `bun install failed — fix and re-run it inside ${optionSet.targetDirectoryName}/`,
  );
  process.exit(1);
}

if (optionSet.shouldRunSetup && optionSet.shouldInstall && process.stdout.isTTY) {
  const didSetupSucceed = runInTarget(['bun', setupBundlePath], targetDirectory);
  process.exit(didSetupSucceed ? 0 : 1);
}

console.log(
  [
    '',
    'Scaffolded. Next steps:',
    `  cd ${optionSet.targetDirectoryName}`,
    ...(optionSet.shouldInstall ? [] : ['  bun install']),
    '  bun run setup   (the interactive wizard)',
  ].join('\n'),
);
