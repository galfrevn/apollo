import { describe, expect, it } from 'bun:test';

import { buildThreadHandoffNote } from '@/threads/handoff';
import {
  mapVectorMemoryIdToThreadSessionId,
  selectThreadForResume,
} from '@/threads/resume';

describe('mapVectorMemoryIdToThreadSessionId', () => {
  it('extracts the session id from a thread vector id', () => {
    expect(mapVectorMemoryIdToThreadSessionId('thread-abc-123')).toBe('abc-123');
  });

  it('ignores plain memory ids and empty suffixes', () => {
    expect(mapVectorMemoryIdToThreadSessionId('memory-abc')).toBeUndefined();
    expect(mapVectorMemoryIdToThreadSessionId('thread-')).toBeUndefined();
  });
});

describe('selectThreadForResume', () => {
  const candidateList = [
    { sessionId: 't1', title: 'Viaje a Salta', summary: 'Ruta en auto por Tucumán.' },
    { sessionId: 't2', title: 'Timer de pasta', summary: null },
    { sessionId: 't3', title: 'Firmware del despertador', summary: 'Bug del wake word.' },
  ];

  it('matches query words against title and summary', () => {
    expect(selectThreadForResume(candidateList, 'lo del viaje')?.sessionId).toBe('t1');
    expect(selectThreadForResume(candidateList, 'el bug del firmware')?.sessionId).toBe(
      't3',
    );
  });

  it('prefers the candidate matching more query words', () => {
    const matched = selectThreadForResume(candidateList, 'viaje en auto por salta');
    expect(matched?.sessionId).toBe('t1');
  });

  it('returns undefined when nothing matches or the query is too short', () => {
    expect(selectThreadForResume(candidateList, 'clima')).toBeUndefined();
    expect(selectThreadForResume(candidateList, 'a')).toBeUndefined();
  });
});

describe('buildThreadHandoffNote', () => {
  it('wraps the transcript tail with the previous thread title', () => {
    const note = buildThreadHandoffNote({
      previousThreadTitle: 'Viaje a Salta',
      messageList: [
        { id: 'u1', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
        { id: 'a1', role: 'assistant', parts: [{ type: 'text', text: 'buenas' }] },
      ],
    });

    expect(note).toContain('"Viaje a Salta"');
    expect(note).toContain('Usuario: hola');
    expect(note).toContain('Apollo: buenas');
  });

  it('keeps only the tail when the transcript exceeds the budget', () => {
    const longMessageList = Array.from({ length: 50 }, (_, index) => ({
      id: `m${index}`,
      role: index % 2 === 0 ? 'user' : 'assistant',
      parts: [{ type: 'text', text: `mensaje número ${index} con relleno de texto` }],
    }));
    const note = buildThreadHandoffNote({
      previousThreadTitle: '',
      messageList: longMessageList,
      byteBudget: 300,
    });

    expect(note).toBeDefined();
    expect(note?.length).toBeLessThan(500);
    expect(note).toContain('mensaje número 49');
    expect(note).not.toContain('mensaje número 0 ');
  });

  it('returns undefined for a thread without spoken text', () => {
    const note = buildThreadHandoffNote({
      previousThreadTitle: 'x',
      messageList: [{ id: 'a', role: 'assistant', parts: [{ type: 'reasoning' }] }],
    });

    expect(note).toBeUndefined();
  });
});
