import { describe, expect, it } from 'bun:test';

import { parseApolloQueueJob } from '@/queues/jobs';

describe('apollo queue jobs', () => {
  it('parses index_memory job', () => {
    const job = parseApolloQueueJob({
      type: 'index_memory',
      memoryId: 'm1',
      content: 'tomo mate',
      deviceId: 'desk-1',
    });
    expect(job.type).toBe('index_memory');
    if (job.type === 'index_memory') {
      expect(job.content).toBe('tomo mate');
    }
  });

  it('defaults deviceId for background job', () => {
    const job = parseApolloQueueJob({
      type: 'run_background',
      workflowName: 'apollo-background',
      prompt: 'investigá el clima',
    });
    expect(job.type).toBe('run_background');
    if (job.type === 'run_background') {
      expect(job.deviceId).toBe('default');
    }
  });
});
