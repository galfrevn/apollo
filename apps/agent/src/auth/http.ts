import { resolveApolloConnectionRole } from '@/auth/role';

// The MCP OAuth provider redirects the owner's browser to the agent callback
// path without an Apollo token; the agents SDK validates its own state
// parameter there, so that path must stay reachable.
export async function authorizeApolloHttpRequest(
  request: Request,
  environment: Env,
): Promise<Response | undefined> {
  const requestUrl = new URL(request.url);
  if (requestUrl.pathname.endsWith('/callback')) {
    return undefined;
  }
  const connectionRole = await resolveApolloConnectionRole(requestUrl, environment);
  if (connectionRole === null) {
    return new Response('Unauthorized', { status: 401 });
  }
  return undefined;
}
