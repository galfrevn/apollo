import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const wizardRootDirectory = join(import.meta.dir, '..');
const agentRootDirectory = join(wizardRootDirectory, '..', 'agent');
const sandboxDirectory = join(wizardRootDirectory, '.sandbox');

// The wizard mutates files relative to cwd and expects the generated starter's
// layout, so every dev run gets a fresh sandbox seeded from apps/agent instead
// of touching the real agent workspace.
rmSync(sandboxDirectory, { recursive: true, force: true });
mkdirSync(join(sandboxDirectory, 'src', 'configuration'), { recursive: true });
mkdirSync(join(sandboxDirectory, 'scripts'), { recursive: true });

copyFileSync(
  join(agentRootDirectory, '.dev.vars.example'),
  join(sandboxDirectory, '.dev.vars.example'),
);
copyFileSync(
  join(agentRootDirectory, 'src', 'configuration', 'identity.ts'),
  join(sandboxDirectory, 'src', 'configuration', 'identity.ts'),
);

const stubbedBootstrapSource = [
  "const requestedSubcommand = process.argv[2] ?? 'all';",
  'console.log(',
  '  `[sandbox] bootstrap "${requestedSubcommand}" skipped — the wizard sandbox never provisions Cloudflare resources.`,',
  ');',
  '',
].join('\n');
writeFileSync(join(sandboxDirectory, 'scripts', 'bootstrap.ts'), stubbedBootstrapSource);
writeFileSync(
  join(sandboxDirectory, '.apollo.json'),
  `${JSON.stringify({ workerUrl: 'https://apollo-sandbox.workers.dev' }, null, 2)}\n`,
);

console.log(
  '[sandbox] wizard running against apps/wizard/.sandbox — wrangler auth checks are real, bootstrap is stubbed.',
);

const wizardProcess = Bun.spawnSync(
  ['bun', join(wizardRootDirectory, 'src', 'index.ts')],
  {
    cwd: sandboxDirectory,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  },
);
process.exitCode = wizardProcess.exitCode;
