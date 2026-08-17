import type { JobPublisher } from '@/platform/jobs';
import type { RunLauncher } from '@/platform/runs';
import type { VectorStore } from '@/platform/vector';
import { upsertMemoryVector } from '@/memory/vector';
import { parseApolloQueueJob, type ApolloQueueJob } from '@/queues/jobs';

export type ApolloQueueJobDependencies = {
  readonly vectorStore: VectorStore;
  readonly runLauncher: RunLauncher;
  readonly embedText: (text: string) => Promise<number[]>;
};

export async function executeApolloQueueJob(
  job: ApolloQueueJob,
  dependencies: ApolloQueueJobDependencies,
): Promise<void> {
  if (job.type === 'index_memory') {
    const values = await dependencies.embedText(job.content);
    await upsertMemoryVector({
      vectorStore: dependencies.vectorStore,
      memoryId: job.memoryId,
      content: job.content,
      values,
      deviceId: job.deviceId,
    });
    return;
  }

  if (job.type === 'run_coding') {
    await dependencies.runLauncher.launchCodingRun({
      repository: job.repository,
      task: job.task,
      deviceId: job.deviceId,
    });
    return;
  }

  if (job.type === 'run_background') {
    await dependencies.runLauncher.launchBackgroundRun({
      prompt: job.prompt,
      deviceId: job.deviceId,
    });
  }
}

export async function consumeApolloQueueBatch(
  batch: MessageBatch<unknown>,
  dependencies: ApolloQueueJobDependencies,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const job = parseApolloQueueJob(message.body);
      await executeApolloQueueJob(job, dependencies);
      message.ack();
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: 'apollo_queue_job_failed',
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      message.retry();
    }
  }
}

export async function enqueueMemoryIndexJob(
  jobPublisher: JobPublisher,
  input: {
    readonly memoryId: string;
    readonly content: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await jobPublisher.publish({
    type: 'index_memory',
    memoryId: input.memoryId,
    content: input.content,
    deviceId: input.deviceId,
  });
}

export async function enqueueCodingJob(
  jobPublisher: JobPublisher,
  input: {
    readonly repository: string;
    readonly task: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await jobPublisher.publish({
    type: 'run_coding',
    repository: input.repository,
    task: input.task,
    deviceId: input.deviceId,
  });
}

export async function enqueueBackgroundJob(
  jobPublisher: JobPublisher,
  input: {
    readonly prompt: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await jobPublisher.publish({
    type: 'run_background',
    workflowName: 'apollo-background',
    prompt: input.prompt,
    deviceId: input.deviceId,
  });
}
