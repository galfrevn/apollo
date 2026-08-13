import { describe, expect, it } from 'bun:test';
import type { SessionMessage } from 'agents/experimental/memory/session';

import { buildThreadHandoffNote, THREAD_HANDOFF_BYTE_BUDGET } from '@/threads/handoff';

function buildUserMessage(id: string, text: string): SessionMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function buildAssistantMessage(id: string, text: string): SessionMessage {
  return { id, role: 'assistant', parts: [{ type: 'text', text }] };
}

describe('buildThreadHandoffNote', () => {
  it('returns undefined when the thread has no spoken text', () => {
    expect(
      buildThreadHandoffNote({ previousThreadTitle: 'Viaje a Salta', messageList: [] }),
    ).toBeUndefined();
  });

  it('carries the previous title and the full short transcript', () => {
    const handoffNote = buildThreadHandoffNote({
      previousThreadTitle: 'Viaje a Salta',
      messageList: [
        buildUserMessage('u1', 'quiero planear el viaje'),
        buildAssistantMessage('a1', '¿Para qué fechas?'),
      ],
    });

    expect(handoffNote).toContain('("Viaje a Salta")');
    expect(handoffNote).toContain('Usuario: quiero planear el viaje');
    expect(handoffNote).toContain('Apollo: ¿Para qué fechas?');
  });

  it('omits the title fragment when the previous thread has no title', () => {
    const handoffNote = buildThreadHandoffNote({
      previousThreadTitle: '',
      messageList: [buildUserMessage('u1', 'hola')],
    });

    expect(handoffNote).not.toContain('("');
    expect(handoffNote).toContain('Usuario: hola');
  });

  it('keeps only the transcript tail when the budget is exceeded', () => {
    const messageList = [
      buildUserMessage('u1', 'primera línea que debería caerse'),
      buildAssistantMessage('a1', 'x'.repeat(80)),
      buildUserMessage('u2', 'última línea que debe quedar'),
    ];
    const handoffNote = buildThreadHandoffNote({
      previousThreadTitle: 'Larga',
      messageList,
      byteBudget: 120,
    });

    expect(handoffNote).toBeDefined();
    expect(handoffNote).toContain('Usuario: última línea que debe quedar');
    expect(handoffNote).not.toContain('primera línea que debería caerse');
  });

  it('exposes a sane default budget', () => {
    expect(THREAD_HANDOFF_BYTE_BUDGET).toBeGreaterThan(0);
  });
});
