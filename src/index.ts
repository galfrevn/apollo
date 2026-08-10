import { routeAgentRequest } from 'agents';
import { Sandbox } from '@cloudflare/sandbox';

import { authorizeApolloConnection, Apollo } from '@/agents/apollo';
import { consumeApolloQueueBatch } from '@/queues/consume';
import { ApolloBackground } from '@/workflows/background';
import { ApolloCoding } from '@/workflows/coding';

export { Apollo, ApolloBackground, ApolloCoding, Sandbox };

export default {
  async fetch(request: Request, environment: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === '/health') {
      return Response.json({
        ok: true,
        name: 'apollo',
        features: ['session', 'vectorize', 'r2', 'queues', 'workflows'],
      });
    }

    const agentResponse = await routeAgentRequest(request, environment, {
      onBeforeConnect: async (connectRequest) =>
        authorizeApolloConnection(connectRequest, environment),
    });

    if (agentResponse !== undefined && agentResponse !== null) {
      return agentResponse;
    }

    return new Response('Not found', { status: 404 });
  },

  async queue(batch: MessageBatch<unknown>, environment: Env): Promise<void> {
    await consumeApolloQueueBatch(batch, environment);
  },
} satisfies ExportedHandler<Env>;
