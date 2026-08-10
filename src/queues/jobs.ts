import { z } from 'zod';

export const apolloQueueJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('index_memory'),
    memoryId: z.string().min(1),
    content: z.string().min(1),
    deviceId: z.string().min(1).default('default'),
  }),
  z.object({
    type: z.literal('run_background'),
    workflowName: z.string().min(1),
    prompt: z.string().min(1),
    deviceId: z.string().min(1).default('default'),
  }),
  z.object({
    type: z.literal('run_coding'),
    repository: z.string().min(1),
    task: z.string().min(1),
    deviceId: z.string().min(1).default('default'),
  }),
]);

export type ApolloQueueJob = z.infer<typeof apolloQueueJobSchema>;

export function parseApolloQueueJob(rawPayload: unknown): ApolloQueueJob {
  return apolloQueueJobSchema.parse(rawPayload);
}
