import { describe, expect, it } from 'bun:test';

import { CODING_TOKEN_ENVIRONMENT_NAME } from '@/coding/git';
import {
  buildAgentSandboxPort,
  commitAndPushCodingChanges,
  prepareCodingWorkspace,
  type SandboxLike,
} from '@/coding/run';
import { parseGithubRepositoryReference } from '@/github/repository';

type RecordedExec = {
  readonly command: string;
  readonly cwd?: string;
  readonly env?: Record<string, string>;
};

function createFakeSandbox(
  execResultByFragment: readonly {
    readonly fragment: string;
    readonly result: { stdout: string; stderr: string; exitCode: number };
  }[] = [],
): { readonly sandbox: SandboxLike; readonly execList: RecordedExec[] } {
  const execList: RecordedExec[] = [];
  return {
    execList,
    sandbox: {
      exec: async (command, options) => {
        execList.push({
          command,
          ...(options?.cwd !== undefined ? { cwd: options.cwd } : {}),
          ...(options?.env !== undefined ? { env: options.env } : {}),
        });
        const matched = execResultByFragment.find((candidate) =>
          command.includes(candidate.fragment),
        );
        return matched?.result ?? { stdout: '', stderr: '', exitCode: 0 };
      },
      listFiles: async () => [],
      readFile: async () => ({ content: '' }),
      writeFile: async () => {},
    },
  };
}

const apolloRepository = parseGithubRepositoryReference('galfrevn/apollo');
const commitIdentity = {
  name: 'apollo[bot]',
  email: '1+apollo[bot]@users.noreply.github.com',
};

describe('prepareCodingWorkspace', () => {
  it('clones with the token in env only, then sets identity and branch', async () => {
    const { sandbox, execList } = createFakeSandbox();

    await prepareCodingWorkspace({
      sandbox,
      repository: apolloRepository,
      baseBranch: 'main',
      branchName: 'apollo/x-1',
      commitIdentity,
      installationToken: 'ghs_secrettoken',
    });

    expect(execList).toHaveLength(3);
    expect(execList[0].command).toContain('clone');
    expect(execList[0].env).toEqual({
      [CODING_TOKEN_ENVIRONMENT_NAME]: 'ghs_secrettoken',
    });
    // The secret must never appear in the command itself.
    expect(execList[0].command).not.toContain('ghs_secrettoken');
    expect(execList[1].command).toContain('git config user.email');
    expect(execList[2].command).toContain("checkout -b 'apollo/x-1'");
  });

  it('surfaces a git failure with the token redacted', async () => {
    const { sandbox } = createFakeSandbox([
      {
        fragment: 'clone',
        result: {
          stdout: '',
          stderr: 'fatal: could not read Username for ghs_secrettoken',
          exitCode: 128,
        },
      },
    ]);

    const failure = await prepareCodingWorkspace({
      sandbox,
      repository: apolloRepository,
      baseBranch: 'main',
      branchName: 'apollo/x-1',
      commitIdentity,
      installationToken: 'ghs_secrettoken',
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain('ghs_secrettoken');
    expect(String(failure)).toContain('***');
  });
});

describe('commitAndPushCodingChanges', () => {
  it('skips the commit entirely when the agent changed nothing', async () => {
    const { sandbox, execList } = createFakeSandbox([
      {
        fragment: 'status --porcelain',
        result: { stdout: '\n  \n', stderr: '', exitCode: 0 },
      },
    ]);

    const outcome = await commitAndPushCodingChanges({
      sandbox,
      branchName: 'apollo/x-1',
      commitMessage: 'nada',
      installationToken: 'ghs_secrettoken',
    });

    expect(outcome.didPush).toBe(false);
    expect(execList).toHaveLength(1);
    expect(execList.some((call) => call.command.includes('push'))).toBe(false);
  });

  it('commits and pushes only the work branch when the tree is dirty', async () => {
    const { sandbox, execList } = createFakeSandbox([
      {
        fragment: 'status --porcelain',
        result: { stdout: ' M src/index.ts\n', stderr: '', exitCode: 0 },
      },
    ]);

    const outcome = await commitAndPushCodingChanges({
      sandbox,
      branchName: 'apollo/x-1',
      commitMessage: 'fix: arreglar typo',
      installationToken: 'ghs_secrettoken',
    });

    expect(outcome.didPush).toBe(true);
    expect(outcome.changedFileSummary).toBe('M src/index.ts');
    const pushCall = execList.find((call) => call.command.includes('push'));
    expect(pushCall?.command).toContain("push origin 'apollo/x-1'");
    expect(pushCall?.env).toEqual({
      [CODING_TOKEN_ENVIRONMENT_NAME]: 'ghs_secrettoken',
    });
  });
});

describe('buildAgentSandboxPort', () => {
  it('never lets the agent pass environment variables to a command', async () => {
    const { sandbox, execList } = createFakeSandbox();
    const agentPort = buildAgentSandboxPort(sandbox);

    await agentPort.exec('printenv', { cwd: '/workspace/repo', timeout: 1000 });

    expect(execList[0].env).toBeUndefined();
  });
});
