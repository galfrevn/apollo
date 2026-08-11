import { routeAgentRequest } from 'agents';
import { Sandbox } from '@cloudflare/sandbox';

import { authorizeApolloConnection, Apollo } from '@/agents/apollo';
import { CODING_PROXY_PATH_PREFIX, handleCodingLlmProxyRequest } from '@/coding/proxy';
import { handleOtaRequest } from '@/ota/routes';
import { APOLLO_DEVICE_PROTOCOL_VERSION } from '@/protocol/version';
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
        protocol: APOLLO_DEVICE_PROTOCOL_VERSION,
        features: ['session', 'vectorize', 'r2', 'queues', 'workflows'],
      });
    }

    if (requestUrl.pathname.startsWith('/ota/')) {
      return handleOtaRequest(request, requestUrl, environment);
    }

    if (requestUrl.pathname.startsWith(`${CODING_PROXY_PATH_PREFIX}/`)) {
      return handleCodingLlmProxyRequest(request, requestUrl, environment);
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
