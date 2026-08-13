import { chmodSync } from 'node:fs';
import { join } from 'node:path';

const entryFilePath = join(import.meta.dir, 'src', 'index.ts');
const outputFilePath = join(import.meta.dir, 'dist', 'index.js');

const bundleResult = Bun.spawnSync(
  [
    'bun',
    'build',
    entryFilePath,
    '--target=node',
    `--outfile=${outputFilePath}`,
    '--banner=#!/usr/bin/env node',
  ],
  { stdout: 'inherit', stderr: 'inherit' },
);
if (bundleResult.exitCode !== 0) {
  throw new Error('bin bundling failed');
}
chmodSync(outputFilePath, 0o755);
console.log(`bin bundled at ${outputFilePath}`);
