import { describe, expect, it } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import { recallConversationTool, resumeConversationTool } from '@/tools/history';
import type { ToolExecutionContext } from '@/tools/types';

function buildContext(effects: ToolExecutionContext['effects']): ToolExecutionContext {
  return {
    environment: createFakeApolloEnvironment(),
    nowMilliseconds: 1,
    ...(effects === undefined ? {} : { effects }),
  };
}

describe('recall_conversation', () => {
  it('fails without effects', async () => {
    const result = await recallConversationTool.handler(
      { query: 'salta' },
      buildContext(undefined),
    );
    expect(result.ok).toBe(false);
  });

  it('reports when nothing matches', async () => {
    const result = await recallConversationTool.handler(
      { query: 'salta' },
      buildContext(createStubDeskToolEffects()),
    );
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('No encontré conversaciones pasadas sobre salta');
  });

  it('summarizes matches with speaker labels', async () => {
    const effects = createStubDeskToolEffects({
      searchThreadHistory: async () => [
        { id: 'match-1', role: 'user', content: 'quiero ir a Salta' },
        { id: 'match-2', role: 'assistant', content: 'te armo la ruta' },
      ],
    });
    const result = await recallConversationTool.handler(
      { query: 'salta', limit: 2 },
      buildContext(effects),
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Usuario: quiero ir a Salta');
    expect(result.summary).toContain('Apollo: te armo la ruta');
  });
});

describe('resume_conversation', () => {
  it('fails without effects', async () => {
    const result = await resumeConversationTool.handler(
      { query: 'salta' },
      buildContext(undefined),
    );
    expect(result.ok).toBe(false);
  });

  it('reports when no past conversation is found', async () => {
    const result = await resumeConversationTool.handler(
      { query: 'salta' },
      buildContext(createStubDeskToolEffects()),
    );
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('No encontré una conversación anterior');
  });

  it('announces the resumed thread with its summary when present', async () => {
    const effects = createStubDeskToolEffects({
      resumeConversationThread: async () => ({
        title: 'Viaje a Salta',
        summary: 'Ruta en auto con parada en Tucumán',
      }),
    });
    const result = await resumeConversationTool.handler(
      { query: 'salta' },
      buildContext(effects),
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('Retomo la conversación "Viaje a Salta"');
    expect(result.summary).toContain('Ruta en auto con parada en Tucumán');
  });

  it('skips the summary sentence when the thread has none', async () => {
    const effects = createStubDeskToolEffects({
      resumeConversationThread: async () => ({ title: 'Viaje a Salta', summary: null }),
    });
    const result = await resumeConversationTool.handler(
      { query: 'salta' },
      buildContext(effects),
    );

    expect(result.summary).toBe('Retomo la conversación "Viaje a Salta".');
  });
});
