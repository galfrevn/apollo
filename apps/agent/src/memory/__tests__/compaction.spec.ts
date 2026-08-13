import { describe, expect, it } from 'bun:test';
import type { SessionMessage } from 'agents/experimental/memory/session';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import {
  compactThreadMessageList,
  mapRecentHistoryToChatMessageList,
} from '@/memory/session';

function buildMessage(
  id: string,
  role: 'user' | 'assistant',
  text: string,
): SessionMessage {
  return { id, role, parts: [{ type: 'text', text }] };
}

function buildLongMessageList(messageCount: number): SessionMessage[] {
  return Array.from({ length: messageCount }, (unused, messageIndex) =>
    buildMessage(
      `m${messageIndex}`,
      messageIndex % 2 === 0 ? 'user' : 'assistant',
      `mensaje número ${messageIndex}`,
    ),
  );
}

function createFakeOpenRouterFetch(summaryText: string): typeof fetch {
  const fetchLike = async () =>
    new Response(JSON.stringify({ choices: [{ message: { content: summaryText } }] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  return Object.assign(fetchLike, { preconnect: () => {} });
}

describe('compactThreadMessageList', () => {
  it('skips compaction entirely in mock voice mode', async () => {
    const environment = createFakeApolloEnvironment({ MOCK_VOICE: '1' });
    const compactionResult = await compactThreadMessageList(
      environment,
      buildLongMessageList(30),
    );
    expect(compactionResult).toBeNull();
  });

  it('leaves short threads untouched', async () => {
    const environment = createFakeApolloEnvironment({ MOCK_VOICE: '0' });
    const compactionResult = await compactThreadMessageList(
      environment,
      buildLongMessageList(12),
    );
    expect(compactionResult).toBeNull();
  });

  it('returns null when the compactable stretch has no spoken text', async () => {
    const environment = createFakeApolloEnvironment({ MOCK_VOICE: '0' });
    const silentMessageList = Array.from({ length: 30 }, (unused, messageIndex) => ({
      id: `m${messageIndex}`,
      role: 'user' as const,
      parts: [],
    }));
    const compactionResult = await compactThreadMessageList(
      environment,
      silentMessageList,
    );
    expect(compactionResult).toBeNull();
  });

  it('summarizes the old stretch and keeps the recent tail out of it', async () => {
    const environment = createFakeApolloEnvironment({ MOCK_VOICE: '0' });
    const messageList = buildLongMessageList(30);
    const compactionResult = await compactThreadMessageList(
      environment,
      messageList,
      createFakeOpenRouterFetch('Hablaron del viaje a Salta y quedó pendiente el auto.'),
    );

    expect(compactionResult).not.toBeNull();
    expect(compactionResult?.fromMessageId).toBe('m0');
    expect(compactionResult?.toMessageId).toBe('m19');
    expect(compactionResult?.summary).toContain('viaje a Salta');
  });

  it('returns null when the model produces an empty summary', async () => {
    const environment = createFakeApolloEnvironment({ MOCK_VOICE: '0' });
    const compactionResult = await compactThreadMessageList(
      environment,
      buildLongMessageList(30),
      createFakeOpenRouterFetch('   '),
    );
    expect(compactionResult).toBeNull();
  });
});

describe('mapRecentHistoryToChatMessageList', () => {
  it('keeps only spoken user and assistant turns', () => {
    const messageList: SessionMessage[] = [
      buildMessage('u1', 'user', 'hola'),
      { id: 's1', role: 'system', parts: [{ type: 'text', text: 'interno' }] },
      { id: 'u2', role: 'user', parts: [] },
      buildMessage('a1', 'assistant', 'buenas'),
    ];

    expect(mapRecentHistoryToChatMessageList(messageList)).toEqual([
      { role: 'user', content: 'hola' },
      { role: 'assistant', content: 'buenas' },
    ]);
  });
});
