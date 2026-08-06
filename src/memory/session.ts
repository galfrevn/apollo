import {
  AgentSearchProvider,
  R2SkillProvider,
  Session,
} from 'agents/experimental/memory/session';

import type { Apollo } from '@/agents/apollo';
import { buildApolloSoulPrompt } from '@/persona/soul';

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
