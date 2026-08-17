import { describe, expect, test } from 'bun:test';

import { createFakeMediaBlobStore, createFakeStepRunner } from '@/configuration/testing';
import { executeCodingTaskRun } from '@/runs/coding';
import type { CodingRunDependencies, CodingSandboxHandle } from '@/runs/coding';
import { CODING_UNAVAILABLE_SPOKEN_SUMMARY } from '@/sandbox/capability';

function createRecordingDependencies(): {
  dependencies: CodingRunDependencies;
  notificationList: { prompt: string; summary: string; documentKey?: string }[];
  destroyedSandboxIdList: string[];
  mediaBlobStore: ReturnType<typeof createFakeMediaBlobStore>;
} {
  const notificationList: { prompt: string; summary: string; documentKey?: string }[] =
    [];
  const destroyedSandboxIdList: string[] = [];
  const mediaBlobStore = createFakeMediaBlobStore();
  const createSandbox = async (sandboxId: string): Promise<CodingSandboxHandle> => ({
    exec: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    listFiles: async () => [],
    readFile: async () => ({ content: '' }),
    writeFile: async () => {},
    destroy: async () => {
      destroyedSandboxIdList.push(sandboxId);
    },
  });
  return {
    notificationList,
    destroyedSandboxIdList,
    mediaBlobStore,
    dependencies: {
      openRouterApiKey: '',
      codingModelId: 'modelo-coding',
      codingEngine: undefined,
      codingProxyOrigin: undefined,
      githubAppId: '1',
      githubAppPrivateKeyPem: '',
      mediaBlobStore,
      mintCodingProxyToken: async () => 'token',
      createSandbox,
      notifyApollo: async (notification) => {
        notificationList.push(notification);
      },
    },
  };
}

describe('executeCodingTaskRun', () => {
  test('without a sandbox it notifies the degraded summary and runs no steps', async () => {
    const { stepRunner, stepNameList } = createFakeStepRunner();
    const { dependencies, notificationList } = createRecordingDependencies();

    const runResult = await executeCodingTaskRun({
      params: { repository: 'acme/apollo', task: 'auditar', deviceId: 'desk' },
      instanceId: 'instancia-1',
      steps: stepRunner,
      dependencies: { ...dependencies, createSandbox: undefined },
    });

    expect(stepNameList).toEqual([]);
    expect(runResult.summary).toBe(CODING_UNAVAILABLE_SPOKEN_SUMMARY);
    expect(notificationList[0]?.summary).toBe(CODING_UNAVAILABLE_SPOKEN_SUMMARY);
  });

  test('the publish path keeps the full step-name sequence and reports the pull request', async () => {
    const { stepRunner, stepNameList } = createFakeStepRunner({
      'resolve-github-access': {
        baseBranch: 'main',
        commitIdentity: { name: 'apollo[bot]', email: 'apollo@example.com' },
      },
      'choose-branch': 'apollo/arreglo-abc12345',
      'prepare-workspace': true,
      'run-coding-agent': {
        summary: 'Arreglé el lint.',
        transcript: ['exec: bun run lint'],
        didReachRoundLimit: false,
      },
      'extract-changes': {
        hasChanges: true,
        patchText: 'diff --git a/a.ts b/a.ts',
        changedFileSummary: 'a.ts | 2 +-',
      },
      'publish-changes': true,
      'open-pull-request': {
        url: 'https://github.com/acme/apollo/pull/7',
        number: 7,
      },
    });
    const { dependencies, notificationList, destroyedSandboxIdList, mediaBlobStore } =
      createRecordingDependencies();

    const runResult = await executeCodingTaskRun({
      params: {
        repository: 'acme/apollo',
        task: 'arreglar el lint',
        deviceId: 'desk',
      },
      instanceId: 'instancia-1',
      steps: stepRunner,
      dependencies,
    });

    expect(stepNameList).toEqual([
      'resolve-github-access',
      'choose-branch',
      'prepare-workspace',
      'run-coding-agent',
      'extract-changes',
      'publish-changes',
      'open-pull-request',
      'persist-log',
      'destroy-sandbox',
    ]);
    expect(runResult.summary).toContain('pull request 7');
    expect(runResult.pullRequestUrl).toBe('https://github.com/acme/apollo/pull/7');
    expect(notificationList[0]?.documentKey).toBe('coding/desk/instancia-1.md');
    const persistedLog = await mediaBlobStore.get('coding/desk/instancia-1.md');
    await expect(persistedLog?.text()).resolves.toContain('arreglar el lint');
    expect(destroyedSandboxIdList).toEqual([
      'apollo-coding-instancia-1',
      'apollo-coding-publish-instancia-1',
    ]);
  });
});
