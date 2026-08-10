import type { GithubRepositoryReference } from '@/github/repository';

export const CODING_WORKSPACE_PATH = '/workspace/repo';
export const CODING_TOKEN_ENVIRONMENT_NAME = 'APOLLO_GITHUB_TOKEN';
export const DISABLED_GIT_HOOKS_PATH = '/var/empty/apollo-no-hooks';

const BRANCH_SLUG_MAX_LENGTH = 40;

export function quoteShellArgument(argumentText: string): string {
  return `'${argumentText.replaceAll("'", `'\\''`)}'`;
}

export function buildBranchSlug(taskText: string): string {
  const withoutDiacritics = taskText
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase();
  const slug = withoutDiacritics
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .slice(0, BRANCH_SLUG_MAX_LENGTH)
    .replace(/-+$/, '');
  return slug.length > 0 ? slug : 'tarea';
}

export function buildCodingBranchName(
  taskText: string,
  createSuffix: () => string = () => crypto.randomUUID().slice(0, 8),
): string {
  return `apollo/${buildBranchSlug(taskText)}-${createSuffix()}`;
}

// Reads the token from the environment so it never lands in argv or the remote
// URL, where an echoed command would leak it into output quoted back to the user.
function buildCredentialHelperFlag(): string {
  const helperScript = `!f() { echo username=x-access-token; echo "password=$${CODING_TOKEN_ENVIRONMENT_NAME}"; }; f`;
  return `-c credential.helper=${quoteShellArgument(helperScript)}`;
}

// Any git command carrying the token runs hooks from an empty directory. The
// agent has a shell in this workspace, so it could otherwise drop a pre-push
// hook that git would run with the installation token in its environment.
function buildDisabledHooksFlag(): string {
  return `-c core.hooksPath=${quoteShellArgument(DISABLED_GIT_HOOKS_PATH)}`;
}

export function buildCloneCommand(input: {
  readonly repository: GithubRepositoryReference;
  readonly baseBranch: string;
  readonly workspacePath?: string;
}): string {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;
  const remoteUrl = `https://github.com/${input.repository.owner}/${input.repository.repository}.git`;
  return [
    'git',
    buildCredentialHelperFlag(),
    buildDisabledHooksFlag(),
    'clone',
    '--depth',
    '1',
    '--branch',
    quoteShellArgument(input.baseBranch),
    quoteShellArgument(remoteUrl),
    quoteShellArgument(workspacePath),
  ].join(' ');
}

export function buildConfigureIdentityCommand(input: {
  readonly name: string;
  readonly email: string;
}): string {
  return [
    `git config user.name ${quoteShellArgument(input.name)}`,
    `git config user.email ${quoteShellArgument(input.email)}`,
  ].join(' && ');
}

export function buildCreateBranchCommand(branchName: string): string {
  return `git checkout -b ${quoteShellArgument(branchName)}`;
}

export function buildStageAndCommitCommand(commitMessage: string): string {
  return [
    'git add -A',
    `git ${buildDisabledHooksFlag()} commit -m ${quoteShellArgument(commitMessage)}`,
  ].join(' && ');
}

export function buildPushBranchCommand(branchName: string): string {
  if (branchName.trim().length === 0) {
    throw new Error('No hay branch para pushear');
  }
  return [
    'git',
    buildCredentialHelperFlag(),
    buildDisabledHooksFlag(),
    'push',
    'origin',
    quoteShellArgument(branchName),
  ].join(' ');
}

export function buildChangedFileListCommand(): string {
  return 'git status --porcelain';
}

export function hasStagedOrUnstagedChanges(porcelainOutput: string): boolean {
  return porcelainOutput.trim().length > 0;
}
