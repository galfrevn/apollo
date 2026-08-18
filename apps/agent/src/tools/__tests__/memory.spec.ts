import { describe, expect, it, mock } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import { recallMemoryTool, rememberFactTool } from '@/tools/memory';
import type { ToolExecutionContext } from '@/tools/types';

const context: ToolExecutionContext = {
  environment: createFakeApolloEnvironment(),
  nowMilliseconds: 0,
  deviceId: 'desk-01',
};

mock.module('@/memory/vector', () => ({
  embedTextWithOpenRouter: async () => [0.1, 0.2, 0.3],
  queryMemoryVectors: async () => [
    { id: 'memory-1', content: 'La reunión es el viernes', score: 0.95 },
    { id: 'memory-empty', content: '', score: 0.5 },
  ],
}));

describe('remember_fact', () => {
  it('persists the fact and speaks the stored content', async () => {
    const result = await rememberFactTool.handler(
      { content: 'La reunión es el viernes' },
      {
        ...context,
        effects: createStubDeskToolEffects({
          persistMemory: async (content) => ({
            memoryId: 'memory-1',
            content,
          }),
        }),
      },
    );

    expect(result).toEqual({
      ok: true,
      summary: 'Recordado: La reunión es el viernes',
      data: { memoryId: 'memory-1', content: 'La reunión es el viernes' },
    });
  });

  it('reports unavailable effects instead of throwing', async () => {
    const result = await rememberFactTool.handler({ content: 'dato' }, context);

    expect(result).toEqual({ ok: false, summary: 'Effects no disponibles' });
  });
});

describe('recall_memory', () => {
  it('summarizes only matches that contain usable content', async () => {
    const result = await recallMemoryTool.handler(
      { query: 'reunión', limit: 3 },
      context,
    );

    expect(result).toEqual({
      ok: true,
      summary: 'Recordé 1 cosas: La reunión es el viernes',
      data: {
        matchList: [{ id: 'memory-1', content: 'La reunión es el viernes', score: 0.95 }],
      },
    });
  });

  it('returns a speakable failure when embedding fails', async () => {
    mock.module('@/memory/vector', () => ({
      embedTextWithOpenRouter: async () => {
        throw new Error('embedding unavailable');
      },
      queryMemoryVectors: async () => [],
    }));

    const result = await recallMemoryTool.handler({ query: 'reunión' }, context);

    expect(result).toEqual({
      ok: false,
      summary: 'No pude recordar: embedding unavailable',
    });
  });
});
