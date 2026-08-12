import { describe, expect, it } from 'bun:test';

import { mapSessionMessagesToConsoleHistory } from '@/console/history';

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
      { id: 'a', role: 'user', text: 'poné un timer' },
      { id: 'b', role: 'assistant', text: 'Listo,\ntimer de 5 minutos.' },
    ]);
  });

  it('drops non-text parts and empty messages', () => {
    const turnList = mapSessionMessagesToConsoleHistory([
      { id: 'a', role: 'assistant', parts: [{ type: 'reasoning' }] },
      { id: 'b', role: 'user', parts: [{ type: 'text', text: '   ' }] },
      { id: 'c', role: 'user', parts: [{ type: 'text', text: 'hola' }] },
    ]);

    expect(turnList).toEqual([{ id: 'c', role: 'user', text: 'hola' }]);
  });
});
