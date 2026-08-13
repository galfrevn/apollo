import { describe, expect, it } from 'bun:test';

import { buildMcpOauthLandingResponse } from '@/mcp/landing';

describe('mcp oauth landing page', () => {
  it('renders a success page with a 200 status', async () => {
    const response = buildMcpOauthLandingResponse({ authSuccess: true });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/html');
    expect(html).toContain('Server authorized');
    expect(html).toContain('refresh the MCP page');
  });

  it('renders the provider error with a 400 status', async () => {
    const response = buildMcpOauthLandingResponse({
      authSuccess: false,
      authError: 'access_denied',
    });
    const html = await response.text();

    expect(response.status).toBe(400);
    expect(html).toContain('Authorization failed');
    expect(html).toContain('access_denied');
  });

  it('escapes markup in provider errors', async () => {
    const response = buildMcpOauthLandingResponse({
      authSuccess: false,
      authError: '<script>alert("x")</script>',
    });
    const html = await response.text();

    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('falls back to an unknown error label', async () => {
    const response = buildMcpOauthLandingResponse({ authSuccess: false });
    const html = await response.text();

    expect(html).toContain('unknown error');
  });
});
