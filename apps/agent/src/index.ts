import { routeAgentRequest } from 'agents';
import { Sandbox } from '@cloudflare/sandbox';

import { authorizeApolloConnection, Apollo } from '@/agents/apollo';
import { authorizeApolloHttpRequest } from '@/auth/http';
import { CODING_PROXY_PATH_PREFIX, handleCodingLlmProxyRequest } from '@/coding/proxy';
import { handleOtaRequest } from '@/ota/routes';
import { consumeApolloQueueBatch } from '@/queues/consume';
import { ApolloBackground } from '@/workflows/background';
import { ApolloCoding } from '@/workflows/coding';

export { Apollo, ApolloBackground, ApolloCoding, Sandbox };

// The hosted management console probes /health cross-origin before opening
// the agent WebSocket; auth is the query token, never a cookie, so a wildcard
// origin does not widen what the token already gates.
const CONSOLE_CORS_HEADER_MAP = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
} as const;

export default {
  async fetch(request: Request, environment: Env): Promise<Response> {
    const requestUrl = new URL(request.url);

    if (requestUrl.pathname === '/health') {
      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: CONSOLE_CORS_HEADER_MAP });
      }
      return Response.json(
        {
          ok: true,
          name: 'apollo',
          features: [
            'session',
            'vectorize',
            'r2',
            'queues',
            'workflows',
            ...(environment.Sandbox !== undefined ? ['coding'] : []),
          ],
        },
        { headers: CONSOLE_CORS_HEADER_MAP },
      );
    }

    if (requestUrl.pathname.startsWith('/ota/')) {
      return handleOtaRequest(request, requestUrl, environment);
    }

    if (requestUrl.pathname.startsWith(`${CODING_PROXY_PATH_PREFIX}/`)) {
      return handleCodingLlmProxyRequest(request, requestUrl, environment);
    }

    const agentResponse = await routeAgentRequest(request, environment, {
      cors: true,
      onBeforeConnect: async (connectRequest) =>
        authorizeApolloConnection(connectRequest, environment),
      onBeforeRequest: async (httpRequest) =>
        authorizeApolloHttpRequest(httpRequest, environment),
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
