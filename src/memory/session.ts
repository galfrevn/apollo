import {
  AgentSearchProvider,
  R2SkillProvider,
  Session,
  type SessionMessage,
} from 'agents/experimental/memory/session';

import type { Apollo } from '@/agents/apollo';
import { buildApolloSoulPrompt } from '@/persona/soul';
import type { OpenRouterChatMessage } from '@/voice/llm';

const RECENT_TURN_HISTORY_BYTE_BUDGET = 8_000;
const RECENT_TURN_HISTORY_MIN_MESSAGE_COUNT = 10;

export function createApolloSession(agent: Apollo, mediaBucket: R2Bucket): Session {
  return Session.create(agent)
    .forSession('desk-main')
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
    })
    .withContext('knowledge', {
      description: 'Base de conocimiento buscable (FTS)',
      provider: new AgentSearchProvider(agent),
    })
    .withContext('skills', {
      description: 'Documentos largos en R2 (load on demand)',
      provider: new R2SkillProvider(mediaBucket, { prefix: 'skills/' }),
    })
    .withCachedPrompt();
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

export async function buildRecentTurnHistoryMessageList(
  session: Session,
): Promise<readonly OpenRouterChatMessage[]> {
  const recentHistory = await session.getRecentHistory(
    RECENT_TURN_HISTORY_BYTE_BUDGET,
    RECENT_TURN_HISTORY_MIN_MESSAGE_COUNT,
  );
  return recentHistory.messages
    .map(mapSessionMessageToChatMessage)
    .filter((message): message is OpenRouterChatMessage => message !== undefined);
}
