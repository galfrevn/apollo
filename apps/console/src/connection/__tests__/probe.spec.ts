import { describe, expect, it } from 'bun:test';

import { probeWorkerHealth } from '@/connection/probe';

describe('worker health probe', () => {
  it('reports ok for a healthy apollo worker', async () => {
    const probeResult = await probeWorkerHealth('https://apollo.example', async () =>
      Response.json({ ok: true, name: 'apollo' }),
    );
    expect(probeResult.outcome).toBe('ok');
  });

  it('reports unreachable when fetch throws', async () => {
    const probeResult = await probeWorkerHealth('https://apollo.example', async () => {
      throw new TypeError('network error');
    });
    expect(probeResult.outcome).toBe('unreachable');
  });

  it('reports not-apollo for a non-ok response', async () => {
    const probeResult = await probeWorkerHealth(
      'https://apollo.example',
      async () => new Response('Not found', { status: 404 }),
    );
    expect(probeResult.outcome).toBe('not-apollo');
  });

  it('reports not-apollo for a different json shape', async () => {
    const probeResult = await probeWorkerHealth('https://apollo.example', async () =>
      Response.json({ hello: 'world' }),
    );
    expect(probeResult.outcome).toBe('not-apollo');
  });

  it('probes the /health path on the given origin', async () => {
    let requestedUrl = '';
    await probeWorkerHealth('https://apollo.example', async (input) => {
      requestedUrl = String(input);
      return Response.json({ ok: true, name: 'apollo' });
    });
    expect(requestedUrl).toBe('https://apollo.example/health');
  });
});
