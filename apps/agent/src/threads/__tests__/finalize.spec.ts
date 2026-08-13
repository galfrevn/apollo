import { describe, expect, it } from 'bun:test';

import type { SessionMessage } from 'agents/experimental/memory/session';

import {
  buildFallbackThreadTitle,
  classifyThreadMessages,
  flattenThreadMessagesToTranscript,
  parseThreadDigestResult,
  runThreadFinalization,
} from '@/threads/finalize';

function buildUserMessage(id: string, text: string): SessionMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function buildAssistantMessage(id: string, text: string): SessionMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] };
}

const commandExchange: SessionMessage[] = [
  buildUserMessage('u1', 'poné un timer de diez minutos'),
  buildAssistantMessage('a1', 'Listo, timer de diez minutos.'),
];

const conversationExchange: SessionMessage[] = [
  buildUserMessage('u1', 'quiero planear el viaje a Salta'),
  buildAssistantMessage('a1', '¿Para qué fechas?'),
  buildUserMessage('u2', 'la primera semana de octubre'),
  buildAssistantMessage('a2', 'Anotado, ¿en auto o en avión?'),
  buildUserMessage('u3', 'en auto, quiero parar en Tucumán'),
  buildAssistantMessage('a3', 'Buena ruta, te armo un borrador.'),
];

describe('classifyThreadMessages', () => {
  it('marks short exchanges as commands', () => {
    expect(classifyThreadMessages(commandExchange)).toBe('command');
  });

  it('marks longer exchanges as conversations', () => {
    expect(classifyThreadMessages(conversationExchange)).toBe('conversation');
  });

  it('ignores user messages without spoken text', () => {
    const messageList: SessionMessage[] = [
      ...commandExchange,
      { id: 'u2', role: 'user', parts: [{ type: 'tool-call' }] },
      { id: 'u3', role: 'user', parts: [{ type: 'text', text: '   ' }] },
    ];

    expect(classifyThreadMessages(messageList)).toBe('command');
  });
});

describe('buildFallbackThreadTitle', () => {
  it('uses the first spoken user turn', () => {
    expect(buildFallbackThreadTitle(conversationExchange)).toBe(
      'quiero planear el viaje a Salta',
    );
  });

  it('truncates long first turns with an ellipsis', () => {
    const longText = 'a'.repeat(80);
    const title = buildFallbackThreadTitle([buildUserMessage('u1', longText)]);

    expect(title).toBe(`${'a'.repeat(59)}…`);
    expect(title?.length).toBe(60);
  });

  it('returns undefined when no user turn has text', () => {
    expect(buildFallbackThreadTitle([buildAssistantMessage('a1', 'hola')])).toBe(
      undefined,
    );
  });
});

describe('parseThreadDigestResult', () => {
  it('parses a fenced JSON reply', () => {
    const digest = parseThreadDigestResult(
      '```json\n{"title": "Viaje a Salta", "summary": "Planeamos el viaje en auto."}\n```',
    );

    expect(digest).toEqual({
      title: 'Viaje a Salta',
      summary: 'Planeamos el viaje en auto.',
    });
  });

  it('rejects replies without a usable JSON object', () => {
    expect(parseThreadDigestResult('no pude resumir')).toBeUndefined();
    expect(parseThreadDigestResult('{"title": ""}')).toBeUndefined();
  });
});

describe('runThreadFinalization', () => {
  it('titles commands from the first turn without calling the LLM', async () => {
    let digestCallCount = 0;
    let renamedTitle: string | undefined;
    let persistedOutcome:
      | { kind: string; title: string | null; summary: string | null }
      | undefined;

    await runThreadFinalization({
      getThreadMessages: async () => commandExchange,
      generateThreadDigest: async () => {
        digestCallCount += 1;
        return undefined;
      },
      renameThread: async (title) => {
        renamedTitle = title;
      },
      persistOutcome: async (outcome) => {
        persistedOutcome = outcome;
      },
    });

    expect(digestCallCount).toBe(0);
    expect(renamedTitle).toBe('poné un timer de diez minutos');
    expect(persistedOutcome).toEqual({
      kind: 'command',
      title: 'poné un timer de diez minutos',
      summary: null,
    });
  });

  it('titles and summarizes conversations from the digest', async () => {
    let receivedTranscript: string | undefined;
    let renamedTitle: string | undefined;
    let persistedOutcome:
      | { kind: string; title: string | null; summary: string | null }
      | undefined;

    await runThreadFinalization({
      getThreadMessages: async () => conversationExchange,
      generateThreadDigest: async (transcriptText) => {
        receivedTranscript = transcriptText;
        return { title: 'Viaje a Salta', summary: 'Viaje en auto en octubre.' };
      },
      renameThread: async (title) => {
        renamedTitle = title;
      },
      persistOutcome: async (outcome) => {
        persistedOutcome = outcome;
      },
    });

    expect(receivedTranscript).toBe(
      flattenThreadMessagesToTranscript(conversationExchange),
    );
    expect(renamedTitle).toBe('Viaje a Salta');
    expect(persistedOutcome).toEqual({
      kind: 'conversation',
      title: 'Viaje a Salta',
      summary: 'Viaje en auto en octubre.',
    });
  });

  it('falls back to the first turn when the digest is unusable', async () => {
    let renamedTitle: string | undefined;
    let persistedOutcome:
      | { kind: string; title: string | null; summary: string | null }
      | undefined;

    await runThreadFinalization({
      getThreadMessages: async () => conversationExchange,
      generateThreadDigest: async () => undefined,
      renameThread: async (title) => {
        renamedTitle = title;
      },
      persistOutcome: async (outcome) => {
        persistedOutcome = outcome;
      },
    });

    expect(renamedTitle).toBe('quiero planear el viaje a Salta');
    expect(persistedOutcome).toEqual({
      kind: 'conversation',
      title: 'quiero planear el viaje a Salta',
      summary: null,
    });
  });
});
