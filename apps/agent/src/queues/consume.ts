import { embedTextWithOpenRouter, upsertMemoryVector } from '@/memory/vector';
import { parseApolloQueueJob } from '@/queues/jobs';

export async function consumeApolloQueueBatch(
  batch: MessageBatch<unknown>,
  environment: Env,
): Promise<void> {
  for (const message of batch.messages) {
    try {
      const job = parseApolloQueueJob(message.body);

      if (job.type === 'index_memory') {
        const values = await embedTextWithOpenRouter({
          openRouterApiKey: environment.OPENROUTER_API_KEY,
          modelId: environment.OPENROUTER_EMBEDDING_MODEL,
          text: job.content,
        });
        await upsertMemoryVector({
          vectorizeIndex: environment.VECTORIZE,
          memoryId: job.memoryId,
          content: job.content,
          values,
          deviceId: job.deviceId,
        });
        message.ack();
        continue;
      }

      if (job.type === 'run_coding') {
        await environment.CODING.create({
          id: crypto.randomUUID(),
          params: {
            repository: job.repository,
            task: job.task,
            deviceId: job.deviceId,
          },
        });
        message.ack();
        continue;
      }

      if (job.type === 'run_background') {
        await environment.BACKGROUND.create({
          id: crypto.randomUUID(),
          params: {
            prompt: job.prompt,
            deviceId: job.deviceId,
          },
        });
        message.ack();
        continue;
      }

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
  environment: Env,
  input: {
    readonly memoryId: string;
    readonly content: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await environment.APOLLO_QUEUE.send({
    type: 'index_memory',
    memoryId: input.memoryId,
    content: input.content,
    deviceId: input.deviceId,
  });
}

export async function enqueueCodingJob(
  environment: Env,
  input: {
    readonly repository: string;
    readonly task: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await environment.APOLLO_QUEUE.send({
    type: 'run_coding',
    repository: input.repository,
    task: input.task,
    deviceId: input.deviceId,
  });
}

export async function enqueueBackgroundJob(
  environment: Env,
  input: {
    readonly prompt: string;
    readonly deviceId: string;
  },
): Promise<void> {
  await environment.APOLLO_QUEUE.send({
    type: 'run_background',
    workflowName: 'apollo-background',
    prompt: input.prompt,
    deviceId: input.deviceId,
  });
}
