import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import {
  AgentContextProvider,
  AgentSearchProvider,
  SessionManager,
} from 'agents/experimental/memory/session';

import { createBunSqliteSqlProvider } from '@/platform/bun/sql';

// The phase 2 load-bearing claim: the SDK session manager needs only a
// synchronous `sql` tagged template, so it runs on bun:sqlite outside a
// durable object. This spec exercises the exact surface apollo uses
// (createApolloSessionManager + rememberFactInSession + turn persistence).
function createSessionManagerOnSqlite() {
  const database = new Database(':memory:');
  const sqlProvider = createBunSqliteSqlProvider(database);
  const sessionManager = SessionManager.create(sqlProvider)
    .withContext('soul', {
      provider: { get: async () => 'Sos Apollo, un asistente de escritorio.' },
    })
    .withContext('memory', {
      description: 'Hechos y preferencias aprendidas del usuario',
      maxTokens: 1100,
      provider: new AgentContextProvider(sqlProvider, 'memory_desk-main'),
    })
    .withContext('handoff', {
      description: 'Cierre del hilo anterior',
      maxTokens: 400,
    })
    .withContext('knowledge', {
      description: 'Base de conocimiento buscable (FTS)',
      provider: new AgentSearchProvider(sqlProvider),
    })
    .withCachedPrompt()
    .compactAfter(20_000);
  return { database, sessionManager };
}

describe('SDK session manager on bun:sqlite', () => {
  test('creates sessions, persists turns, and freezes a system prompt', async () => {
    const { sessionManager } = createSessionManagerOnSqlite();
    const session = sessionManager.getSession('thread-1');

    await session.appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'hola apollo' }],
      createdAt: new Date(),
    });
    await session.appendMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      parts: [{ type: 'text', text: 'hola, ¿qué necesitás?' }],
      createdAt: new Date(),
    });

    const recentHistory = await session.getRecentHistory(8_000, 10);
    expect(recentHistory.messages).toHaveLength(2);

    const systemPrompt = await session.freezeSystemPrompt();
    expect(systemPrompt).toContain('Sos Apollo');
  });

  test('appendContextBlock + refreshSystemPrompt carries learned facts across sessions', async () => {
    const { sessionManager } = createSessionManagerOnSqlite();
    const firstSession = sessionManager.getSession('thread-1');
    await firstSession.appendContextBlock('memory', '\n- toma mate amargo');
    await firstSession.refreshSystemPrompt();

    const secondSession = sessionManager.getSession('thread-2');
    const systemPrompt = await secondSession.freezeSystemPrompt();
    expect(systemPrompt).toContain('toma mate amargo');
  });

  test('the FTS search provider indexes and finds appended turns', async () => {
    const { sessionManager } = createSessionManagerOnSqlite();
    const session = sessionManager.getSession('thread-1');
    await session.appendMessage({
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'el router wifi está en el estante de arriba' }],
      createdAt: new Date(),
    });

    const searchResultList = await session.search('router wifi');
    expect(searchResultList.length).toBeGreaterThan(0);
  });

  test('sessions can be listed, renamed, and deleted through the manager', async () => {
    const { sessionManager } = createSessionManagerOnSqlite();
    const sessionInfo = sessionManager.create('Charla inicial');
    await sessionManager.append(sessionInfo.id, {
      id: crypto.randomUUID(),
      role: 'user',
      parts: [{ type: 'text', text: 'hola' }],
      createdAt: new Date(),
    });

    expect(sessionManager.get(sessionInfo.id)).not.toBeNull();
    sessionManager.rename(sessionInfo.id, 'Charla renombrada');
    await sessionManager.delete(sessionInfo.id);
    expect(sessionManager.get(sessionInfo.id)).toBeNull();
  });
});
