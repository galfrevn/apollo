import {
  Session,
  type RecentHistoryResult,
  type SessionMessage,
  type SessionProvider,
  type StoredCompaction,
} from 'agents/experimental/memory/session';
import { describe, expect, it } from 'bun:test';

import {
  buildRecentTurnHistoryMessageList,
  mapRecentHistoryToChatMessageList,
} from '@/memory/session';

function createFakeSessionProvider(recentHistoryResult: RecentHistoryResult) {
  const getRecentHistoryCallArgList: [
    leafId: string | null | undefined,
    maxContentBytes: number,
    minRecentMessages: number | undefined,
  ][] = [];
  const provider: SessionProvider = {
    getMessage: () => null,
    getHistory: () => [],
    getLatestLeaf: () => null,
    getBranches: () => [],
    getPathLength: () => 0,
    getRecentHistory: (leafId, maxContentBytes, minRecentMessages) => {
      getRecentHistoryCallArgList.push([leafId, maxContentBytes, minRecentMessages]);
      return recentHistoryResult;
    },
    appendMessage: () => {},
    updateMessage: () => {},
    deleteMessages: () => {},
    clearMessages: () => {},
    addCompaction: (summary, fromMessageId, toMessageId): StoredCompaction => ({
      id: 'compaction-1',
      summary,
      fromMessageId,
      toMessageId,
      createdAt: new Date(0).toISOString(),
    }),
    getCompactions: () => [],
  };
  return { provider, getRecentHistoryCallArgList };
}

describe('mapRecentHistoryToChatMessageList', () => {
  it('keeps user and assistant turns in chronological order', () => {
    const chatMessageList = mapRecentHistoryToChatMessageList([
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'Dame ideas para el finde' }],
      },
      {
        id: '2',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Podés ir a la costa o quedarte a leer.' }],
      },
      { id: '3', role: 'user', parts: [{ type: 'text', text: 'Mandámelas por mail' }] },
    ]);

    expect(chatMessageList).toEqual([
      { role: 'user', content: 'Dame ideas para el finde' },
      { role: 'assistant', content: 'Podés ir a la costa o quedarte a leer.' },
      { role: 'user', content: 'Mandámelas por mail' },
    ]);
  });

  it('drops roles other than user and assistant', () => {
    const chatMessageList = mapRecentHistoryToChatMessageList([
      { id: '1', role: 'system', parts: [{ type: 'text', text: 'Prompt de sistema' }] },
      { id: '2', role: 'tool', parts: [{ type: 'text', text: 'resultado de tool' }] },
      { id: '3', role: 'user', parts: [{ type: 'text', text: 'Hola' }] },
    ]);

    expect(chatMessageList).toEqual([{ role: 'user', content: 'Hola' }]);
  });

  it('skips messages that carry no spoken text', () => {
    const chatMessageList = mapRecentHistoryToChatMessageList([
      { id: '1', role: 'user', parts: [{ type: 'tool-call', toolName: 'set_timer' }] },
      { id: '2', role: 'user', parts: [{ type: 'text', text: '  ' }] },
      { id: '3', role: 'assistant', parts: [{ type: 'text', text: 'Listo el timer.' }] },
    ]);

    expect(chatMessageList).toEqual([{ role: 'assistant', content: 'Listo el timer.' }]);
  });

  it('joins multiple text parts of the same message', () => {
    const chatMessageList = mapRecentHistoryToChatMessageList([
      {
        id: '1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Primera parte.' },
          { type: 'text', text: 'Segunda parte.' },
        ],
      },
    ]);

    expect(chatMessageList).toEqual([
      { role: 'assistant', content: 'Primera parte. Segunda parte.' },
    ]);
  });
});

describe('buildRecentTurnHistoryMessageList', () => {
  it('reads the session recency window and maps it to chat messages', async () => {
    const storedMessageList: SessionMessage[] = [
      {
        id: '1',
        role: 'user',
        parts: [{ type: 'text', text: 'dame ideas para el finde' }],
      },
      { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'andá a la costa' }] },
    ];
    const { provider, getRecentHistoryCallArgList } = createFakeSessionProvider({
      messages: storedMessageList,
      truncated: false,
      totalContentBytes: 42,
    });
    const session = Session.create(provider).forSession('test-session');

    const chatMessageList = await buildRecentTurnHistoryMessageList(session);

    expect(chatMessageList).toEqual([
      { role: 'user', content: 'dame ideas para el finde' },
      { role: 'assistant', content: 'andá a la costa' },
    ]);
    expect(getRecentHistoryCallArgList).toHaveLength(1);
    const [, maxContentBytes, minRecentMessages] = getRecentHistoryCallArgList[0];
    expect(maxContentBytes).toBe(8_000);
    expect(minRecentMessages).toBe(10);
  });
});
