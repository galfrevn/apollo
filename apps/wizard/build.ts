import { chmodSync } from 'node:fs';
import { join } from 'node:path';

function bundleEntry(input: {
  readonly entryRelativePath: string;
  readonly outputFileName: string;
  readonly target: 'node' | 'bun';
  readonly bannerText?: string;
}): string {
  const outputFilePath = join(import.meta.dir, 'dist', input.outputFileName);
  const bundleResult = Bun.spawnSync(
    [
      'bun',
      'build',
      join(import.meta.dir, input.entryRelativePath),
      `--target=${input.target}`,
      `--outfile=${outputFilePath}`,
      ...(input.bannerText === undefined ? [] : [`--banner=${input.bannerText}`]),
    ],
    { stdout: 'inherit', stderr: 'inherit' },
  );
  if (bundleResult.exitCode !== 0) {
    throw new Error(`bundling failed for ${input.entryRelativePath}`);
  }
  return outputFilePath;
}

const binFilePath = bundleEntry({
  entryRelativePath: join('cli', 'index.ts'),
  outputFileName: 'index.js',
  target: 'node',
  bannerText: '#!/usr/bin/env node',
});
chmodSync(binFilePath, 0o755);

// The wizard needs Bun APIs at runtime; the bin spawns it with `bun`.
bundleEntry({
  entryRelativePath: join('src', 'index.ts'),
  outputFileName: 'setup.js',
  target: 'bun',
});

console.log(`bin and setup bundled under ${join(import.meta.dir, 'dist')}`);
