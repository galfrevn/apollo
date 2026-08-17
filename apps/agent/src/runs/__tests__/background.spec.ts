import { describe, expect, test } from 'bun:test';

import { createFakeMediaBlobStore, createFakeStepRunner } from '@/configuration/testing';
import { executeBackgroundResearchRun } from '@/runs/background';
import type { BackgroundRunDependencies } from '@/runs/background';

function createRecordingDependencies(): {
  dependencies: BackgroundRunDependencies;
  notificationList: { prompt: string; summary: string; documentKey?: string }[];
  mediaBlobStore: ReturnType<typeof createFakeMediaBlobStore>;
} {
  const notificationList: { prompt: string; summary: string; documentKey?: string }[] =
    [];
  const mediaBlobStore = createFakeMediaBlobStore();
  return {
    notificationList,
    mediaBlobStore,
    dependencies: {
      openRouterApiKey: '',
      researchModelId: 'perplexity/sonar-deep-research',
      chatModelId: 'modelo-chat',
      resendApiKey: undefined,
      ownerEmailAddress: undefined,
      mediaBlobStore,
      notifyApollo: async (notification) => {
        notificationList.push(notification);
      },
    },
  };
}

describe('executeBackgroundResearchRun', () => {
  test('runs the full step sequence and notifies with the spoken summary', async () => {
    const { stepRunner, stepNameList } = createFakeStepRunner({
      'deep-research': '# informe largo',
      'synthesize-spoken-summary': 'Encontré tres opciones.',
    });
    const { dependencies, notificationList, mediaBlobStore } =
      createRecordingDependencies();

    const runResult = await executeBackgroundResearchRun({
      params: { prompt: 'investigar pasajes', deviceId: 'desk' },
      instanceId: 'instancia-1',
      steps: stepRunner,
      dependencies,
    });

    expect(stepNameList).toEqual([
      'deep-research',
      'persist-document',
      'email-report',
      'synthesize-spoken-summary',
      'notify-apollo',
    ]);
    expect(runResult.summary).toBe('Encontré tres opciones.');
    expect(runResult.documentKey).toBe('research/desk/instancia-1.md');
    const persistedDocument = await mediaBlobStore.get('research/desk/instancia-1.md');
    await expect(persistedDocument?.text()).resolves.toBe('# informe largo');
    expect(notificationList).toEqual([
      {
        prompt: 'investigar pasajes',
        summary: 'Encontré tres opciones.',
        documentKey: 'research/desk/instancia-1.md',
      },
    ]);
  });

  test('an empty report short-circuits into the failure notification', async () => {
    const { stepRunner, stepNameList } = createFakeStepRunner({
      'deep-research': '',
    });
    const { dependencies, notificationList } = createRecordingDependencies();

    const runResult = await executeBackgroundResearchRun({
      params: { prompt: 'investigar pasajes', deviceId: 'desk' },
      instanceId: 'instancia-1',
      steps: stepRunner,
      dependencies,
    });

    expect(stepNameList).toEqual(['deep-research', 'notify-apollo-failure']);
    expect(runResult.documentKey).toBeUndefined();
    expect(notificationList).toHaveLength(1);
    expect(notificationList[0]?.summary).toContain('No pude conseguir fuentes');
  });
});
