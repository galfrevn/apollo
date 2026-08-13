import { cpSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const starterToolingDirectory = join(import.meta.dir, '..', 'starter');
const templateDirectory = join(import.meta.dir, 'template');

const generatorResult = Bun.spawnSync(
  ['bun', join(starterToolingDirectory, 'build.ts')],
  { stdout: 'inherit', stderr: 'inherit' },
);
if (generatorResult.exitCode !== 0) {
  throw new Error('starter generation failed — template not refreshed');
}

rmSync(templateDirectory, { recursive: true, force: true });
cpSync(join(starterToolingDirectory, 'out'), templateDirectory, { recursive: true });
// npm pack silently drops .gitignore files from packages; the scaffolder
// renames the undotted copy back on the user's machine.
renameSync(join(templateDirectory, '.gitignore'), join(templateDirectory, 'gitignore'));
console.log(`template refreshed at ${templateDirectory}`);
