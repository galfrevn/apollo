export type McpOauthCallbackResult = {
  readonly authSuccess: boolean;
  readonly authError?: string;
};

function escapeHtml(rawText: string): string {
  return rawText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function buildMcpOauthLandingResponse(result: McpOauthCallbackResult): Response {
  const headline = result.authSuccess ? 'Server authorized' : 'Authorization failed';
  const detail = result.authSuccess
    ? 'You can close this tab and refresh the MCP page in the console. If the server still says authenticating, use Retry connection in its panel.'
    : `The server refused the authorization: ${escapeHtml(result.authError ?? 'unknown error')}. Close this tab and install it again from the console.`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark" />
    <title>Apollo — ${headline}</title>
  </head>
  <body style="margin:0;min-height:100dvh;display:grid;place-items:center;background:#0d0d0d;color:#fafafa;font-family:system-ui,sans-serif;">
    <main style="max-width:26rem;padding:2rem;text-align:center;">
      <svg width="26" height="26" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <rect x="1" y="1" width="8.5" height="8.5" />
        <rect x="10.5" y="1" width="8.5" height="8.5" opacity="0.45" />
        <rect x="1" y="10.5" width="8.5" height="8.5" opacity="0.45" />
        <rect x="10.5" y="10.5" width="8.5" height="8.5" opacity="0.18" />
      </svg>
      <h1 style="margin:1.25rem 0 0;font-family:Georgia,serif;font-weight:400;font-size:2rem;">${headline}</h1>
      <p style="margin:0.75rem 0 0;font-size:0.875rem;line-height:1.6;color:#878787;">${detail}</p>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status: result.authSuccess ? 200 : 400,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
