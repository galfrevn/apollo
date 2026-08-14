import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { parseCreateCommandArgumentList, scaffoldStarterProject } from '@/scaffold';

function createFixtureTemplateDirectory(): string {
  const fixtureDirectory = mkdtempSync(join(tmpdir(), 'create-heyapollo-fixture-'));
  writeFileSync(join(fixtureDirectory, 'package.json'), '{"name":"apollo-starter"}');
  writeFileSync(join(fixtureDirectory, 'gitignore'), 'node_modules/\n');
  mkdirSync(join(fixtureDirectory, 'setup'));
  writeFileSync(join(fixtureDirectory, 'setup', 'index.ts'), 'export {};');
  return fixtureDirectory;
}

describe('scaffoldStarterProject', () => {
  it('copies the template into an empty target', async () => {
    const templateDirectory = createFixtureTemplateDirectory();
    const targetDirectory = join(
      mkdtempSync(join(tmpdir(), 'create-heyapollo-target-')),
      'apollo',
    );
    scaffoldStarterProject({ templateDirectory, targetDirectory });
    expect(await Bun.file(join(targetDirectory, 'package.json')).text()).toContain(
      'apollo-starter',
    );
    expect(await Bun.file(join(targetDirectory, 'setup', 'index.ts')).exists()).toBe(
      true,
    );
    expect(await Bun.file(join(targetDirectory, '.gitignore')).text()).toContain(
      'node_modules',
    );
    expect(await Bun.file(join(targetDirectory, 'gitignore')).exists()).toBe(false);
  });

  it('refuses a non-empty target', () => {
    const templateDirectory = createFixtureTemplateDirectory();
    const occupiedTargetDirectory = mkdtempSync(
      join(tmpdir(), 'create-heyapollo-occupied-'),
    );
    writeFileSync(join(occupiedTargetDirectory, 'existing.txt'), 'already here');
    expect(() =>
      scaffoldStarterProject({
        templateDirectory,
        targetDirectory: occupiedTargetDirectory,
      }),
    ).toThrow(/not empty/);
  });

  it('refuses a missing template', () => {
    expect(() =>
      scaffoldStarterProject({
        templateDirectory: '/nonexistent/template',
        targetDirectory: join(mkdtempSync(join(tmpdir(), 'x-')), 'apollo'),
      }),
    ).toThrow(/template missing/);
  });
});

describe('parseCreateCommandArgumentList', () => {
  it('defaults to the apollo directory with everything enabled', () => {
    expect(parseCreateCommandArgumentList([])).toEqual({
      targetDirectoryName: 'apollo',
      shouldInstall: true,
      shouldRunSetup: true,
      shouldInitializeGit: true,
    });
  });

  it('reads the target name and the opt-out flags', () => {
    expect(parseCreateCommandArgumentList(['my-desk', '--no-setup', '--no-git'])).toEqual(
      {
        targetDirectoryName: 'my-desk',
        shouldInstall: true,
        shouldRunSetup: false,
        shouldInitializeGit: false,
      },
    );
  });
});
