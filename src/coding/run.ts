import {
  buildApplyPatchCommand,
  buildChangedFileListCommand,
  buildCloneCommand,
  buildCommitCommand,
  buildConfigureIdentityCommand,
  buildCreateBranchCommand,
  buildPushBranchCommand,
  buildStageAllCommand,
  buildWritePatchCommand,
  CODING_PATCH_PATH,
  CODING_TOKEN_ENVIRONMENT_NAME,
  CODING_WORKSPACE_PATH,
  hasStagedOrUnstagedChanges,
} from '@/coding/git';
import type { CodingSandboxPort } from '@/coding/agent';
import type { GithubCommitIdentity } from '@/github/api';
import type { GithubRepositoryReference } from '@/github/repository';
import { redactSecretsFromText } from '@/github/repository';

const GIT_COMMAND_TIMEOUT_MILLISECONDS = 600_000;

export type SandboxExecResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
};

export type SandboxLike = {
  readonly exec: (
    command: string,
    options?: {
      readonly cwd?: string;
      readonly env?: Record<string, string>;
      readonly timeout?: number;
    },
  ) => Promise<SandboxExecResult>;
  readonly listFiles: (
    path: string,
  ) => Promise<readonly { readonly path: string; readonly isDirectory: boolean }[]>;
  readonly readFile: (path: string) => Promise<{ readonly content: string }>;
  readonly writeFile: (path: string, content: string) => Promise<void>;
};

// Passes no environment, so the agent's run_command tool cannot read the
// installation token that git commands run with.
export function buildAgentSandboxPort(sandbox: SandboxLike): CodingSandboxPort {
  return {
    listFiles: (path) => sandbox.listFiles(path),
    readFile: (path) => sandbox.readFile(path),
    writeFile: (path, content) => sandbox.writeFile(path, content),
    exec: async (command, options) =>
      sandbox.exec(command, { cwd: options.cwd, timeout: options.timeout }),
  };
}

async function runGitCommand(input: {
  readonly sandbox: SandboxLike;
  readonly command: string;
  readonly installationToken?: string;
  readonly cwd?: string;
}): Promise<SandboxExecResult> {
  const result = await input.sandbox.exec(input.command, {
    ...(input.cwd !== undefined ? { cwd: input.cwd } : {}),
    ...(input.installationToken !== undefined
      ? { env: { [CODING_TOKEN_ENVIRONMENT_NAME]: input.installationToken } }
      : {}),
    timeout: GIT_COMMAND_TIMEOUT_MILLISECONDS,
  });
  if (result.exitCode !== 0) {
    const failureText = redactSecretsFromText(
      `${result.stderr}\n${result.stdout}`.trim(),
      [input.installationToken],
    );
    throw new Error(`git falló (exit ${result.exitCode}): ${failureText.slice(0, 600)}`);
  }
  return result;
}

export async function prepareCodingWorkspace(input: {
  readonly sandbox: SandboxLike;
  readonly repository: GithubRepositoryReference;
  readonly baseBranch: string;
  readonly installationToken: string;
  readonly workspacePath?: string;
}): Promise<void> {
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildCloneCommand({
      repository: input.repository,
      baseBranch: input.baseBranch,
      workspacePath: input.workspacePath ?? CODING_WORKSPACE_PATH,
    }),
    installationToken: input.installationToken,
  });
}

export type CodingChangeExtraction = {
  readonly hasChanges: boolean;
  readonly changedFileSummary: string;
  readonly patchText: string;
};

// Runs in the agent-tainted sandbox: no command here may carry the token.
export async function extractCodingChanges(input: {
  readonly sandbox: SandboxLike;
  readonly workspacePath?: string;
  readonly patchPath?: string;
}): Promise<CodingChangeExtraction> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;
  const patchPath = input.patchPath ?? CODING_PATCH_PATH;

  await runGitCommand({
    sandbox: input.sandbox,
    command: buildStageAllCommand(),
    cwd: workspacePath,
  });
  const statusResult = await runGitCommand({
    sandbox: input.sandbox,
    command: buildChangedFileListCommand(),
    cwd: workspacePath,
  });
  if (!hasStagedOrUnstagedChanges(statusResult.stdout)) {
    return { hasChanges: false, changedFileSummary: '', patchText: '' };
  }

  await runGitCommand({
    sandbox: input.sandbox,
    command: buildWritePatchCommand(patchPath),
    cwd: workspacePath,
  });
  const patchFile = await input.sandbox.readFile(patchPath);

  return {
    hasChanges: true,
    changedFileSummary: statusResult.stdout.trim(),
    patchText: patchFile.content,
  };
}

// Must run in a fresh sandbox the agent never had a shell in.
export async function publishCodingChanges(input: {
  readonly sandbox: SandboxLike;
  readonly repository: GithubRepositoryReference;
  readonly baseBranch: string;
  readonly branchName: string;
  readonly commitIdentity: GithubCommitIdentity;
  readonly commitMessage: string;
  readonly patchText: string;
  readonly installationToken: string;
  readonly workspacePath?: string;
  readonly patchPath?: string;
}): Promise<void> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;
  const patchPath = input.patchPath ?? CODING_PATCH_PATH;

  await runGitCommand({
    sandbox: input.sandbox,
    command: buildCloneCommand({
      repository: input.repository,
      baseBranch: input.baseBranch,
      workspacePath,
    }),
    installationToken: input.installationToken,
  });
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildConfigureIdentityCommand(input.commitIdentity),
    cwd: workspacePath,
  });
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildCreateBranchCommand(input.branchName),
    cwd: workspacePath,
  });
  await input.sandbox.writeFile(patchPath, input.patchText);
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildApplyPatchCommand(patchPath),
    cwd: workspacePath,
  });
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildCommitCommand(input.commitMessage),
    cwd: workspacePath,
  });
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildPushBranchCommand(input.branchName),
    installationToken: input.installationToken,
    cwd: workspacePath,
  });
}
