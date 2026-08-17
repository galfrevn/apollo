import type { ApolloQueueJob } from '@/queues/jobs';

export type JobPublisher = {
  publish(job: ApolloQueueJob): Promise<void>;
};
