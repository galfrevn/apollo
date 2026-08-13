import { describe, expect, it } from 'bun:test';

import { CODING_PATCH_PATH, CODING_TOKEN_ENVIRONMENT_NAME } from '@/coding/git';
import {
  buildAgentSandboxPort,
  extractCodingChanges,
  prepareCodingWorkspace,
  publishCodingChanges,
  type SandboxLike,
} from '@/coding/run';
import { parseGithubRepositoryReference } from '@/github/repository';

type RecordedExec = {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
};

type RecordedWrite = {
  readonly path: string;
  readonly content: string;
};

type FakeSandboxHarness = {
  readonly sandbox: SandboxLike;
  readonly execList: RecordedExec[];
  readonly writeList: RecordedWrite[];
};

function createFakeSandbox(
  execResultByFragment: readonly {
    readonly fragment: string;
    readonly result: { stdout: string; stderr: string; exitCode: number };
  }[] = [],
  fileContentByPath: Readonly<Record<string, string>> = {},
): FakeSandboxHarness {
  const execList: RecordedExec[] = [];
  const writeList: RecordedWrite[] = [];
  return {
    execList,
    writeList,
    sandbox: {
      exec: async (command, options) => {
        const recordedExec: RecordedExec = { command };
        if (options?.cwd !== undefined) {
          recordedExec.cwd = options.cwd;
        }
        if (options?.env !== undefined) {
          recordedExec.env = options.env;
        }
        execList.push(recordedExec);
        const matched = execResultByFragment.find((candidate) =>
          command.includes(candidate.fragment),
        );
        return matched?.result ?? { stdout: '', stderr: '', exitCode: 0 };
      },
      listFiles: async () => [],
      readFile: async (path) => ({ content: fileContentByPath[path] ?? '' }),
      writeFile: async (path, content) => {
        writeList.push({ path, content });
      },
    },
  };
}

const apolloRepository = parseGithubRepositoryReference('example/apollo');
const commitIdentity = {
  name: 'apollo[bot]',
  email: '1+apollo[bot]@users.noreply.github.com',
};

describe('prepareCodingWorkspace', () => {
  it('clones with the token in env only, never in the command', async () => {
    const { sandbox, execList } = createFakeSandbox();

    await prepareCodingWorkspace({
      sandbox,
      repository: apolloRepository,
      baseBranch: 'main',
      installationToken: 'ghs_secrettoken',
    });

    expect(execList).toHaveLength(1);
    expect(execList[0].command).toContain('clone');
    expect(execList[0].env).toEqual({
      [CODING_TOKEN_ENVIRONMENT_NAME]: 'ghs_secrettoken',
    });
    expect(execList[0].command).not.toContain('ghs_secrettoken');
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

    let caughtFailure: unknown;
    try {
      await prepareCodingWorkspace({
        sandbox,
        repository: apolloRepository,
        baseBranch: 'main',
        installationToken: 'ghs_secrettoken',
      });
    } catch (error) {
      caughtFailure = error;
    }

    expect(caughtFailure).toBeInstanceOf(Error);
    expect(String(caughtFailure)).not.toContain('ghs_secrettoken');
    expect(String(caughtFailure)).toContain('***');
  });
});

describe('extractCodingChanges', () => {
  it('reports a clean tree without writing a patch', async () => {
    const { sandbox, execList } = createFakeSandbox([
      {
        fragment: 'status --porcelain',
        result: { stdout: '\n  \n', stderr: '', exitCode: 0 },
      },
    ]);

    const extraction = await extractCodingChanges({ sandbox });

    expect(extraction.hasChanges).toBe(false);
    expect(extraction.patchText).toBe('');
    expect(execList.some((call) => call.command.includes('--output'))).toBe(false);
  });

  it('stages everything, writes the patch, and reads it back', async () => {
    const { sandbox, execList } = createFakeSandbox(
      [
        {
          fragment: 'status --porcelain',
          result: { stdout: ' M src/index.ts\n', stderr: '', exitCode: 0 },
        },
      ],
      { [CODING_PATCH_PATH]: 'diff --git a/src/index.ts b/src/index.ts\n' },
    );

    const extraction = await extractCodingChanges({ sandbox });

    expect(extraction.hasChanges).toBe(true);
    expect(extraction.changedFileSummary).toBe('M src/index.ts');
    expect(extraction.patchText).toContain('diff --git');
    expect(execList[0].command).toBe('git add -A');
  });

  it('never carries the token into the agent-tainted sandbox', async () => {
    const { sandbox, execList } = createFakeSandbox(
      [
        {
          fragment: 'status --porcelain',
          result: { stdout: ' M src/index.ts\n', stderr: '', exitCode: 0 },
        },
      ],
      { [CODING_PATCH_PATH]: 'diff --git a/x b/x\n' },
    );

    await extractCodingChanges({ sandbox });

    expect(execList.every((call) => call.env === undefined)).toBe(true);
  });
});

describe('publishCodingChanges', () => {
  async function publishWithFakeSandbox() {
    const { sandbox, execList, writeList } = createFakeSandbox();
    await publishCodingChanges({
      sandbox,
      repository: apolloRepository,
      baseBranch: 'main',
      branchName: 'apollo/x-1',
      commitIdentity,
      commitMessage: 'fix: arreglar typo',
      patchText: 'diff --git a/src/index.ts b/src/index.ts\n',
      installationToken: 'ghs_secrettoken',
    });
    return { execList, writeList };
  }

  it('clones fresh, applies the patch, commits, and pushes the work branch', async () => {
    const { execList, writeList } = await publishWithFakeSandbox();

    const commandList = execList.map((call) => call.command);
    expect(commandList[0]).toContain('clone');
    expect(commandList[1]).toContain('git config user.email');
    expect(commandList[2]).toContain("checkout -b 'apollo/x-1'");
    expect(commandList[3]).toContain('apply --index');
    expect(commandList[4]).toContain('commit -m');
    expect(commandList[5]).toContain("push --no-verify origin 'apollo/x-1'");
    expect(writeList).toEqual([
      { path: CODING_PATCH_PATH, content: 'diff --git a/src/index.ts b/src/index.ts\n' },
    ]);
  });

  it('exposes the token only to the clone and the push, never in argv', async () => {
    const { execList } = await publishWithFakeSandbox();

    for (const call of execList) {
      expect(call.command).not.toContain('ghs_secrettoken');
      const isTokenCarryingCall =
        call.command.includes('clone') || call.command.includes('push');
      if (isTokenCarryingCall) {
        expect(call.env).toEqual({
          [CODING_TOKEN_ENVIRONMENT_NAME]: 'ghs_secrettoken',
        });
      } else {
        expect(call.env).toBeUndefined();
      }
    }
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
