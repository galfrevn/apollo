import {
  AgentContextProvider,
  AgentSearchProvider,
  R2SkillProvider,
  SessionManager,
  type Session,
  type SessionMessage,
} from 'agents/experimental/memory/session';

import type { Apollo } from '@/agents/apollo';
import { buildApolloSoulPrompt } from '@/persona/soul';
import { chatWithOpenRouter, type OpenRouterChatMessage } from '@/voice/llm';

const RECENT_TURN_HISTORY_BYTE_BUDGET = 8_000;
const RECENT_TURN_HISTORY_MIN_MESSAGE_COUNT = 10;

const THREAD_COMPACTION_TOKEN_THRESHOLD = 20_000;
const COMPACTION_KEEP_RECENT_MESSAGE_COUNT = 10;
const COMPACTION_TRANSCRIPT_CHARACTER_BUDGET = 30_000;

export const LEGACY_THREAD_SESSION_ID = 'desk-main';

// Learned facts predate threads: the old fixed session auto-derived this key
// ('memory' + '_desk-main'), so every thread session must keep pointing at it
// or the owner memory block would silently fragment per thread.
export const SHARED_MEMORY_CONTEXT_KEY = 'memory_desk-main';

// The SDK declares CompactResult without exporting it; this structural twin
// keeps the compaction function typed without reaching into SDK internals.
type ThreadCompactionResult = {
  readonly fromMessageId: string;
  readonly toMessageId: string;
  readonly summary: string;
};

export function createApolloSessionManager(
  agent: Apollo,
  environment: Env,
): SessionManager {
  return (
    SessionManager.create(agent)
      .withContext('soul', {
        provider: {
          get: async () => {
            return buildApolloSoulPrompt(agent.state.speechMode);
          },
        },
      })
      .withContext('memory', {
        description: 'Hechos y preferencias aprendidas del usuario',
        maxTokens: 1100,
        provider: new AgentContextProvider(agent, SHARED_MEMORY_CONTEXT_KEY),
      })
      // Deliberately without a provider: the SDK namespaces it per session, so
      // each thread carries only its own handoff note.
      .withContext('handoff', {
        description: 'Cierre del hilo anterior',
        maxTokens: 400,
      })
      .withContext('knowledge', {
        description: 'Base de conocimiento buscable (FTS)',
        provider: new AgentSearchProvider(agent),
      })
      .withContext('skills', {
        description: 'Documentos largos en R2 (load on demand)',
        provider: new R2SkillProvider(environment.MEDIA, { prefix: 'skills/' }),
      })
      .withCachedPrompt()
      .onCompaction(async (messageList) =>
        compactThreadMessageList(environment, messageList),
      )
      .compactAfter(THREAD_COMPACTION_TOKEN_THRESHOLD)
  );
}

// A marathon thread (or a repeatedly resumed one) can outgrow its token
// budget; compaction folds everything but the recent tail into a summary
// overlay. Originals stay in SQLite, so the console still shows full turns.
export async function compactThreadMessageList(
  environment: Env,
  messageList: SessionMessage[],
  fetchImplementation?: typeof fetch,
): Promise<ThreadCompactionResult | null> {
  // Mock mode has no LLM to call; a dev session must not burn tokens.
  if (environment.MOCK_VOICE === '1') {
    return null;
  }
  if (messageList.length <= COMPACTION_KEEP_RECENT_MESSAGE_COUNT + 4) {
    return null;
  }
  const compactableMessageList = messageList.slice(
    0,
    messageList.length - COMPACTION_KEEP_RECENT_MESSAGE_COUNT,
  );
  const firstMessage = compactableMessageList[0];
  const lastMessage = compactableMessageList[compactableMessageList.length - 1];
  if (firstMessage === undefined || lastMessage === undefined) {
    return null;
  }
  const transcriptText = compactableMessageList
    .map((message) => {
      const spokenText = message.parts
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join(' ')
        .trim();
      if (spokenText.length === 0) {
        return undefined;
      }
      return `${message.role === 'user' ? 'Usuario' : 'Apollo'}: ${spokenText}`;
    })
    .filter((line): line is string => line !== undefined)
    .join('\n')
    .slice(-COMPACTION_TRANSCRIPT_CHARACTER_BUDGET);
  if (transcriptText.length === 0) {
    return null;
  }
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: environment.OPENROUTER_API_KEY,
    modelId: environment.OPENROUTER_MODEL,
    ...(fetchImplementation === undefined ? {} : { fetchImplementation }),
    messageList: [
      {
        role: 'system',
        content:
          'Resumí esta parte vieja de una conversación entre el dueño y su asistente de escritorio en un párrafo en español. Conservá decisiones, datos concretos y pendientes; descartá saludos y relleno.',
      },
      { role: 'user', content: transcriptText },
    ],
  });
  const summaryText = chatResult.text.trim();
  if (summaryText.length === 0) {
    return null;
  }
  return {
    fromMessageId: firstMessage.id,
    toMessageId: lastMessage.id,
    summary: `Resumen de la parte anterior de la conversación: ${summaryText}`,
  };
}

export async function rememberFactInSession(
  session: Session,
  factText: string,
): Promise<void> {
  await session.appendContextBlock('memory', `\n- ${factText}`);
  await session.refreshSystemPrompt();
}

export async function buildSessionSystemPrompt(session: Session): Promise<string> {
  return session.freezeSystemPrompt();
}

function mapSessionMessageToChatMessage(
  message: SessionMessage,
): OpenRouterChatMessage | undefined {
  if (message.role !== 'user' && message.role !== 'assistant') {
    return undefined;
  }
  const messageText = message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim();
  if (messageText.length === 0) {
    return undefined;
  }
  return message.role === 'user'
    ? { role: 'user', content: messageText }
    : { role: 'assistant', content: messageText };
}

export function mapRecentHistoryToChatMessageList(
  messageList: readonly SessionMessage[],
): readonly OpenRouterChatMessage[] {
  return messageList
    .map(mapSessionMessageToChatMessage)
    .filter((message): message is OpenRouterChatMessage => message !== undefined);
}

export async function buildRecentTurnHistoryMessageList(
  session: Session,
): Promise<readonly OpenRouterChatMessage[]> {
  const recentHistory = await session.getRecentHistory(
    RECENT_TURN_HISTORY_BYTE_BUDGET,
    RECENT_TURN_HISTORY_MIN_MESSAGE_COUNT,
  );
  return mapRecentHistoryToChatMessageList(recentHistory.messages);
}
