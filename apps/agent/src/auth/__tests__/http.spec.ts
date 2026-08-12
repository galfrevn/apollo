import { describe, expect, it } from 'bun:test';

import { authorizeApolloHttpRequest } from '@/auth/http';
import { createFakeApolloEnvironment } from '@/configuration/testing';

describe('authorizeApolloHttpRequest', () => {
  const environment = createFakeApolloEnvironment();

  it('rejects a request without a token', async () => {
    const response = await authorizeApolloHttpRequest(
      new Request('https://apollo.example/agents/apollo/desk'),
      environment,
    );
    expect(response?.status).toBe(401);
  });

  it('rejects a request with an unknown token', async () => {
    const response = await authorizeApolloHttpRequest(
      new Request('https://apollo.example/agents/apollo/desk?token=nope'),
      environment,
    );
    expect(response?.status).toBe(401);
  });

  it('passes a request with the dashboard token through', async () => {
    const response = await authorizeApolloHttpRequest(
      new Request('https://apollo.example/agents/apollo/desk?token=dashboard-secret'),
      environment,
    );
    expect(response).toBeUndefined();
  });

  it('passes the MCP OAuth callback through without a token', async () => {
    const response = await authorizeApolloHttpRequest(
      new Request('https://apollo.example/agents/apollo/desk/callback?code=abc'),
      environment,
    );
    expect(response).toBeUndefined();
  });
});
