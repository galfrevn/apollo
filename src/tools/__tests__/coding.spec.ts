import { describe, expect, it } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import { createBuiltinToolDefinitionMap } from '@/tools/catalog';
import { startCodingTaskTool } from '@/tools/coding';
import { executeToolByName } from '@/tools/router';

const fakeEnvironment = createFakeApolloEnvironment();

describe('startCodingTaskTool', () => {
  it('requires confirmation before anything is enqueued', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];
    const outcome = await executeToolByName(
      createBuiltinToolDefinitionMap(),
      'start_coding_task',
      { repository: 'galfrevn/apollo', task: 'arreglar el typo del readme' },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
      () => 'confirm-1',
    );

    expect(outcome.status).toBe('needs_confirm');
    expect(enqueuedList).toHaveLength(0);
    if (outcome.status === 'needs_confirm') {
      expect(outcome.pending.summary).toContain('galfrevn/apollo');
      expect(outcome.pending.summary).toContain('arreglar el typo');
    }
  });

  it('enqueues a normalized repository once the handler runs', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      {
        repository: 'https://github.com/galfrevn/apollo.git',
        task: 'agregar un test',
      },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(true);
    expect(enqueuedList).toEqual([
      { repository: 'galfrevn/apollo', task: 'agregar un test' },
    ]);
  });

  it('refuses an unparseable repository without enqueueing anything', async () => {
    const enqueuedList: { repository: string; task: string }[] = [];

    const result = await startCodingTaskTool.handler(
      { repository: 'no es un repo', task: 'hacer algo' },
      {
        environment: fakeEnvironment,
        nowMilliseconds: 0,
        deviceId: 'desk-01',
        effects: createStubDeskToolEffects({
          enqueueCodingTask: async (input) => {
            enqueuedList.push(input);
          },
        }),
      },
    );

    expect(result.ok).toBe(false);
    expect(enqueuedList).toHaveLength(0);
  });
});
