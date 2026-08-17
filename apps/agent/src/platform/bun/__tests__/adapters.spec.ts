import { afterEach, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createFileBlobStore } from '@/platform/bun/blob';
import { createBunJobQueue } from '@/platform/bun/queue';
import { createBunScheduler } from '@/platform/bun/scheduler';
import { createSqliteStepRunner } from '@/platform/bun/steps';
import { computeCosineSimilarity, createSqliteVectorStore } from '@/platform/bun/vector';
import type { ApolloQueueJob } from '@/queues/jobs';

const temporaryDirectoryList: string[] = [];

function createTemporaryDirectory(): string {
  const directoryPath = join(tmpdir(), `apollo-blob-${crypto.randomUUID()}`);
  temporaryDirectoryList.push(directoryPath);
  return directoryPath;
}

afterEach(async () => {
  for (const directoryPath of temporaryDirectoryList.splice(0)) {
    await rm(directoryPath, { recursive: true, force: true });
  }
});

describe('createFileBlobStore', () => {
  test('round-trips objects and lists by prefix with cursor pagination', async () => {
    const blobStore = createFileBlobStore(createTemporaryDirectory());

    await blobStore.put('research/desk/a.md', '# uno');
    await blobStore.put('research/desk/b.md', '# dos');
    await blobStore.put('coding/desk/c.md', '# tres');

    const storedObject = await blobStore.get('research/desk/a.md');
    await expect(storedObject?.text()).resolves.toBe('# uno');
    expect(storedObject?.size).toBe(5);
    expect(await blobStore.get('missing/key')).toBeNull();

    const firstPage = await blobStore.list({ prefix: 'research/desk/', limit: 1 });
    expect(firstPage.entryList.map((entry) => entry.key)).toEqual(['research/desk/a.md']);
    expect(firstPage.isTruncated).toBe(true);
    const secondPage = await blobStore.list({
      prefix: 'research/desk/',
      limit: 5,
      cursor: firstPage.cursor,
    });
    expect(secondPage.entryList.map((entry) => entry.key)).toEqual([
      'research/desk/b.md',
    ]);
    expect(secondPage.isTruncated).toBe(false);

    await blobStore.delete('research/desk/a.md');
    expect(await blobStore.get('research/desk/a.md')).toBeNull();
  });

  test('rejects traversal in object keys', async () => {
    const blobStore = createFileBlobStore(createTemporaryDirectory());
    await expect(blobStore.get('../outside')).rejects.toThrow('Invalid blob object key');
  });
});

describe('createSqliteVectorStore', () => {
  test('upserts, queries by cosine similarity within a namespace, and deletes', async () => {
    const vectorStore = createSqliteVectorStore(new Database(':memory:'));

    await vectorStore.upsert({
      id: 'mate',
      values: [1, 0],
      namespace: 'desk',
      metadata: { content: 'toma mate amargo' },
    });
    await vectorStore.upsert({
      id: 'cafe',
      values: [0, 1],
      namespace: 'desk',
      metadata: { content: 'no toma café' },
    });
    await vectorStore.upsert({
      id: 'ajeno',
      values: [1, 0],
      namespace: 'otro',
      metadata: { content: 'de otro device' },
    });

    const matchList = await vectorStore.query({
      values: [0.9, 0.1],
      namespace: 'desk',
      topK: 1,
    });
    expect(matchList).toHaveLength(1);
    expect(matchList[0]?.id).toBe('mate');
    expect(matchList[0]?.metadata).toEqual({ content: 'toma mate amargo' });

    await vectorStore.deleteByIds(['mate']);
    const afterDeleteMatchList = await vectorStore.query({
      values: [1, 0],
      namespace: 'desk',
      topK: 5,
    });
    expect(afterDeleteMatchList.map((match) => match.id)).toEqual(['cafe']);
  });

  test('cosine similarity is 1 for identical directions and 0 for orthogonal ones', () => {
    expect(computeCosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(computeCosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(computeCosineSimilarity([], [])).toBe(0);
  });
});

describe('createBunScheduler', () => {
  test('persists delayed, interval, and cron schedules in the SDK shape', async () => {
    let currentTimeMilliseconds = 1_700_000_000_000;
    const scheduler = createBunScheduler({
      database: new Database(':memory:'),
      dispatch: async () => {},
      nowMilliseconds: () => currentTimeMilliseconds,
    });

    const delayedSchedule = await scheduler.schedule(90, 'deliverReminder', {
      message: 'sacar la pizza',
    });
    expect(delayedSchedule.type).toBe('delayed');
    expect(delayedSchedule.time).toBe(1_700_000_090);

    const cronSchedule = await scheduler.schedule('0 6 * * *', 'consolidateOwnerMemory');
    expect(cronSchedule.type).toBe('cron');

    await scheduler.scheduleEvery(1_800, 'refreshDashboardWeather');

    const scheduleList = await scheduler.listSchedules();
    expect(scheduleList).toHaveLength(3);
    const reminderSchedule = scheduleList.find(
      (schedule) => schedule.callback === 'deliverReminder',
    );
    expect(reminderSchedule?.payload).toEqual({ message: 'sacar la pizza' });

    await expect(scheduler.cancelSchedule(delayedSchedule.id)).resolves.toBe(true);
    await expect(scheduler.cancelSchedule('missing')).resolves.toBe(false);
    expect(await scheduler.listSchedules()).toHaveLength(2);
    scheduler.stop();
  });

  test('start dispatches overdue schedules, reschedules recurrences, and drops one-shots', async () => {
    let currentTimeMilliseconds = 1_700_000_000_000;
    const database = new Database(':memory:');
    const dispatchedCallbackList: string[] = [];
    const scheduler = createBunScheduler({
      database,
      dispatch: async (schedule) => {
        dispatchedCallbackList.push(schedule.callback);
      },
      nowMilliseconds: () => currentTimeMilliseconds,
    });

    await scheduler.schedule(60, 'deliverReminder', { message: 'hola' });
    await scheduler.scheduleEvery(120, 'refreshDashboardWeather');

    currentTimeMilliseconds += 130_000;
    await scheduler.start();

    expect(dispatchedCallbackList.toSorted()).toEqual([
      'deliverReminder',
      'refreshDashboardWeather',
    ]);
    const remainingScheduleList = await scheduler.listSchedules();
    expect(remainingScheduleList.map((schedule) => schedule.callback)).toEqual([
      'refreshDashboardWeather',
    ]);
    expect(remainingScheduleList[0]?.time).toBe(
      Math.floor(currentTimeMilliseconds / 1000) + 120,
    );
    scheduler.stop();
  });
});

describe('createBunJobQueue', () => {
  test('publishes, executes, retries with backoff, and drops after max attempts', async () => {
    let currentTimeMilliseconds = 1_700_000_000_000;
    const executedJobList: ApolloQueueJob[] = [];
    let shouldFail = true;
    const jobQueue = createBunJobQueue({
      database: new Database(':memory:'),
      executeJob: async (job) => {
        if (shouldFail) {
          throw new Error('transitorio');
        }
        executedJobList.push(job);
      },
      maxAttemptCount: 3,
      retryDelayMilliseconds: 1_000,
      nowMilliseconds: () => currentTimeMilliseconds,
    });

    await jobQueue.publisher.publish({
      type: 'index_memory',
      memoryId: 'm1',
      content: 'hola',
      deviceId: 'desk',
    });

    await jobQueue.drainOnce();
    expect(executedJobList).toHaveLength(0);

    shouldFail = false;
    await jobQueue.drainOnce();
    expect(executedJobList).toHaveLength(0);

    currentTimeMilliseconds += 1_100;
    await jobQueue.drainOnce();
    expect(executedJobList).toHaveLength(1);
    expect(executedJobList[0]?.type).toBe('index_memory');
  });
});

describe('createSqliteStepRunner', () => {
  test('memoizes step results by (instance, step name) across runner instances', async () => {
    const database = new Database(':memory:');
    let executionCount = 0;
    const firstRunner = createSqliteStepRunner({ database, instanceId: 'run-1' });

    const firstResult = await firstRunner.do('deep-research', async () => {
      executionCount += 1;
      return '# informe';
    });
    expect(firstResult).toBe('# informe');

    const resumedRunner = createSqliteStepRunner({ database, instanceId: 'run-1' });
    const replayedResult: string = await resumedRunner.do('deep-research', async () => {
      executionCount += 1;
      return '# otro';
    });
    expect(replayedResult).toBe('# informe');
    expect(executionCount).toBe(1);

    const otherInstanceRunner = createSqliteStepRunner({
      database,
      instanceId: 'run-2',
    });
    const otherResult = await otherInstanceRunner.do(
      'deep-research',
      async () => '# dos',
    );
    expect(otherResult).toBe('# dos');
  });

  test('retries with the configured backoff before surfacing the error', async () => {
    const waitedDelayList: number[] = [];
    const stepRunner = createSqliteStepRunner({
      database: new Database(':memory:'),
      instanceId: 'run-1',
      wait: async (milliseconds) => {
        waitedDelayList.push(milliseconds);
      },
    });

    let attemptCount = 0;
    const stepResult = await stepRunner.do(
      'flaky-step',
      { retries: { limit: 2, delayMilliseconds: 100, backoff: 'exponential' } },
      async () => {
        attemptCount += 1;
        if (attemptCount < 3) {
          throw new Error('todavía no');
        }
        return 'listo';
      },
    );
    expect(stepResult).toBe('listo');
    expect(waitedDelayList).toEqual([100, 200]);

    await expect(
      stepRunner.do(
        'always-failing',
        { retries: { limit: 1, delayMilliseconds: 50 } },
        async () => {
          throw new Error('permanente');
        },
      ),
    ).rejects.toThrow('permanente');
  });
});
