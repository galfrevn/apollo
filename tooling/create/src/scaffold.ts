// The published bin runs under plain Node (`npm create heyapollo`), so this
// module and its entry stay on node: APIs only — Bun is required by the
// scaffolded project, never by the scaffolder.
import { cpSync, existsSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

export function scaffoldStarterProject(input: {
  readonly templateDirectory: string;
  readonly targetDirectory: string;
}): void {
  if (!existsSync(input.templateDirectory)) {
    throw new Error(
      'template missing from the package — this create-heyapollo build is broken, please report it',
    );
  }
  if (
    existsSync(input.targetDirectory) &&
    readdirSync(input.targetDirectory).length > 0
  ) {
    throw new Error(
      `target directory is not empty: ${input.targetDirectory} — pick a new folder name`,
    );
  }
  cpSync(input.templateDirectory, input.targetDirectory, { recursive: true });
  const undottedGitignorePath = join(input.targetDirectory, 'gitignore');
  if (existsSync(undottedGitignorePath)) {
    renameSync(undottedGitignorePath, join(input.targetDirectory, '.gitignore'));
  }
}

export type CreateCommandOptionSet = {
  readonly targetDirectoryName: string;
  readonly shouldInstall: boolean;
  readonly shouldRunSetup: boolean;
  readonly shouldInitializeGit: boolean;
};

export function parseCreateCommandArgumentList(
  argumentList: readonly string[],
): CreateCommandOptionSet {
  const positionalArgumentList = argumentList.filter(
    (argument) => !argument.startsWith('--'),
  );
  return {
    targetDirectoryName: positionalArgumentList[0] ?? 'apollo',
    shouldInstall: !argumentList.includes('--no-install'),
    shouldRunSetup: !argumentList.includes('--no-setup'),
    shouldInitializeGit: !argumentList.includes('--no-git'),
  };
}
