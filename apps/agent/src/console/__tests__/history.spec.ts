import { describe, expect, it } from 'bun:test';

import {
  mapSessionMessagesToConsoleHistory,
  mapThreadCatalogToConsoleThreadList,
} from '@/console/history';

describe('console history mapping', () => {
  it('joins text parts and keeps roles in order', () => {
    const turnList = mapSessionMessagesToConsoleHistory([
      { id: 'a', role: 'user', parts: [{ type: 'text', text: 'poné un timer' }] },
      {
        id: 'b',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Listo,' },
          { type: 'text', text: 'timer de 5 minutos.' },
        ],
      },
    ]);

    expect(turnList).toEqual([
      {
        id: 'a',
        role: 'user',
        text: 'poné un timer',
        createdAtIso: null,
        toolNameList: [],
      },
      {
        id: 'b',
        role: 'assistant',
        text: 'Listo,\ntimer de 5 minutos.',
        createdAtIso: null,
        toolNameList: [],
      },
    ]);
  });

  it('collects tool-call parts into the turn tool list', () => {
    const turnList = mapSessionMessagesToConsoleHistory([
      {
        id: 'a',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Listo, timer de 5 minutos.' },
          { type: 'tool-call', toolName: 'set_timer' },
        ],
      },
    ]);

    expect(turnList[0]?.toolNameList).toEqual(['set_timer']);
  });

  it('normalizes createdAt into an ISO string when present', () => {
    const turnList = mapSessionMessagesToConsoleHistory([
      {
        id: 'a',
        role: 'user',
        parts: [{ type: 'text', text: 'hola' }],
        createdAt: '2026-08-12T10:00:00.000Z',
      },
      {
        id: 'b',
        role: 'assistant',
        parts: [{ type: 'text', text: 'buenas' }],
        createdAt: new Date('2026-08-12T10:00:05.000Z'),
      },
    ]);

    expect(turnList.map((turn) => turn.createdAtIso)).toEqual([
      '2026-08-12T10:00:00.000Z',
      '2026-08-12T10:00:05.000Z',
    ]);
  });

  it('drops non-text parts and empty messages', () => {
    const turnList = mapSessionMessagesToConsoleHistory([
      { id: 'a', role: 'assistant', parts: [{ type: 'reasoning' }] },
      { id: 'b', role: 'user', parts: [{ type: 'text', text: '   ' }] },
      { id: 'c', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
    ]);

    expect(turnList).toEqual([
      { id: 'c', role: 'user', text: 'hola', createdAtIso: null, toolNameList: [] },
    ]);
  });
});

describe('mapThreadCatalogToConsoleThreadList', () => {
  it('merges session info with thread meta and sorts active first, then recency', () => {
    const threadList = mapThreadCatalogToConsoleThreadList({
      sessionInfoList: [
        { id: 't1', name: 'Viaje a Salta' },
        { id: 't2', name: 'Conversación del 2026-08-12' },
        { id: 't3', name: 'poné un timer' },
      ],
      threadMetaList: [
        {
          sessionId: 't1',
          kind: 'conversation',
          summary: 'Viaje en auto en octubre.',
          lastTurnAtMilliseconds: 1_000,
        },
        {
          sessionId: 't2',
          kind: 'pending',
          summary: null,
          lastTurnAtMilliseconds: 3_000,
        },
        {
          sessionId: 't3',
          kind: 'command',
          summary: null,
          lastTurnAtMilliseconds: 2_000,
        },
      ],
      activeThreadSessionId: 't2',
      hasLegacyHistory: false,
      legacySessionId: 'desk-main',
    });

    expect(threadList.map((thread) => thread.id)).toEqual(['t2', 't3', 't1']);
    expect(threadList[0]?.isActive).toBe(true);
    expect(threadList[2]?.summary).toBe('Viaje en auto en octubre.');
  });

  it('appends the legacy session as a closed conversation when it has history', () => {
    const threadList = mapThreadCatalogToConsoleThreadList({
      sessionInfoList: [],
      threadMetaList: [],
      activeThreadSessionId: null,
      hasLegacyHistory: true,
      legacySessionId: 'desk-main',
    });

    expect(threadList).toEqual([
      {
        id: 'desk-main',
        title: 'Historial previo a los hilos',
        kind: 'conversation',
        isActive: false,
        summary: null,
        lastTurnAtIso: null,
      },
    ]);
  });

  it('marks sessions without meta as pending', () => {
    const threadList = mapThreadCatalogToConsoleThreadList({
      sessionInfoList: [{ id: 't1', name: 'Conversación del 2026-08-12' }],
      threadMetaList: [],
      activeThreadSessionId: null,
      hasLegacyHistory: false,
      legacySessionId: 'desk-main',
    });

    expect(threadList[0]?.kind).toBe('pending');
    expect(threadList[0]?.lastTurnAtIso).toBeNull();
  });
});
