import {
  buildChangedFileListCommand,
  buildCloneCommand,
  buildConfigureIdentityCommand,
  buildCreateBranchCommand,
  buildPushBranchCommand,
  buildStageAndCommitCommand,
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
  readonly branchName: string;
  readonly commitIdentity: GithubCommitIdentity;
  readonly installationToken: string;
  readonly workspacePath?: string;
}): Promise<void> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;

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
}

export type CodingPushOutcome = {
  readonly didPush: boolean;
  readonly changedFileSummary: string;
};

export async function commitAndPushCodingChanges(input: {
  readonly sandbox: SandboxLike;
  readonly branchName: string;
  readonly commitMessage: string;
  readonly installationToken: string;
  readonly workspacePath?: string;
}): Promise<CodingPushOutcome> {
  const workspacePath = input.workspacePath ?? CODING_WORKSPACE_PATH;

  const statusResult = await runGitCommand({
    sandbox: input.sandbox,
    command: buildChangedFileListCommand(),
    cwd: workspacePath,
  });
  if (!hasStagedOrUnstagedChanges(statusResult.stdout)) {
    return { didPush: false, changedFileSummary: '' };
  }

  await runGitCommand({
    sandbox: input.sandbox,
    command: buildStageAndCommitCommand(input.commitMessage),
    cwd: workspacePath,
  });
  await runGitCommand({
    sandbox: input.sandbox,
    command: buildPushBranchCommand(input.branchName),
    installationToken: input.installationToken,
    cwd: workspacePath,
  });

  return { didPush: true, changedFileSummary: statusResult.stdout.trim() };
}
