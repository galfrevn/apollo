import type { JobPublisher } from '@/platform/jobs';

export function createQueueJobPublisher(queue: Env['APOLLO_QUEUE']): JobPublisher {
  return {
    async publish(job) {
      await queue.send(job);
    },
  };
}
