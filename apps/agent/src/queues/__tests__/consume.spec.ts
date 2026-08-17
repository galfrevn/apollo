import { describe, expect, test } from 'bun:test';

import { executeApolloQueueJob } from '@/queues/consume';
import type { ApolloQueueJobDependencies } from '@/queues/consume';
import type { VectorRecord } from '@/platform/vector';

function createRecordingDependencies() {
  const upsertedRecordList: VectorRecord[] = [];
  const launchedRunList: { kind: string; [field: string]: string }[] = [];
  const embeddedTextList: string[] = [];
  const dependencies: ApolloQueueJobDependencies = {
    vectorStore: {
      async upsert(record) {
        upsertedRecordList.push(record);
      },
      async query() {
        return [];
      },
      async deleteByIds() {},
    },
    runLauncher: {
      async launchBackgroundRun(params) {
        launchedRunList.push({ kind: 'background', ...params });
      },
      async launchCodingRun(params) {
        launchedRunList.push({ kind: 'coding', ...params });
      },
    },
    embedText: async (text) => {
      embeddedTextList.push(text);
      return [0.1, 0.2];
    },
  };
  return { dependencies, upsertedRecordList, launchedRunList, embeddedTextList };
}

describe('executeApolloQueueJob', () => {
  test('index_memory embeds the content and upserts under the device namespace', async () => {
    const { dependencies, upsertedRecordList, embeddedTextList } =
      createRecordingDependencies();

    await executeApolloQueueJob(
      {
        type: 'index_memory',
        memoryId: 'mem-1',
        content: 'toma mate amargo',
        deviceId: 'desk',
      },
      dependencies,
    );

    expect(embeddedTextList).toEqual(['toma mate amargo']);
    expect(upsertedRecordList).toEqual([
      {
        id: 'mem-1',
        values: [0.1, 0.2],
        namespace: 'desk',
        metadata: { content: 'toma mate amargo' },
      },
    ]);
  });

  test('run_background launches the background run with its parameters', async () => {
    const { dependencies, launchedRunList } = createRecordingDependencies();

    await executeApolloQueueJob(
      {
        type: 'run_background',
        workflowName: 'apollo-background',
        prompt: 'investigar pasajes',
        deviceId: 'desk',
      },
      dependencies,
    );

    expect(launchedRunList).toEqual([
      { kind: 'background', prompt: 'investigar pasajes', deviceId: 'desk' },
    ]);
  });

  test('run_coding launches the coding run with its parameters', async () => {
    const { dependencies, launchedRunList } = createRecordingDependencies();

    await executeApolloQueueJob(
      {
        type: 'run_coding',
        repository: 'acme/apollo',
        task: 'arreglar el lint',
        deviceId: 'desk',
      },
      dependencies,
    );

    expect(launchedRunList).toEqual([
      {
        kind: 'coding',
        repository: 'acme/apollo',
        task: 'arreglar el lint',
        deviceId: 'desk',
      },
    ]);
  });
});
