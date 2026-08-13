import { describe, expect, it } from 'bun:test';

import { createConsoleRpc } from '@/agent/rpc';

describe('console rpc wrapper', () => {
  it('injects the secret into every call payload', async () => {
    const invokedCallList: Array<{ method: string; args?: unknown[] }> = [];
    const consoleRpc = createConsoleRpc(async (method, args) => {
      invokedCallList.push({ method, args });
      return [];
    }, 'dashboard-secret');

    await consoleRpc.listReminders();
    await consoleRpc.listMcpServers();

    expect(invokedCallList).toEqual([
      { method: 'listConsoleReminders', args: [{ secret: 'dashboard-secret' }] },
      { method: 'listMcpServers', args: [{ secret: 'dashboard-secret' }] },
    ]);
  });

  it('routes tool toggles to the matching enable or disable method', async () => {
    const invokedMethodList: string[] = [];
    const consoleRpc = createConsoleRpc(async (method) => {
      invokedMethodList.push(method);
      return [];
    }, 's');

    await consoleRpc.setToolEnabled('server-1', 'search', true);
    await consoleRpc.setToolEnabled('server-1', 'search', false);

    expect(invokedMethodList).toEqual(['enableMcpTool', 'disableMcpTool']);
  });

  it('validates rpc results and rejects malformed payloads', async () => {
    const consoleRpc = createConsoleRpc(async () => ({ nonsense: true }), 's');
    await expect(consoleRpc.getStatus()).rejects.toThrow();
  });

  it('sends broadcast calls with the secret and parses their outcomes', async () => {
    const invokedCallList: Array<{ method: string; args?: unknown[] }> = [];
    const resultByMethod: Record<string, Record<string, string | number>> = {
      sendConsoleBroadcastText: { outcome: 'delivered' },
      beginConsoleBroadcastAudioUpload: { uploadId: 'upload-1' },
      appendConsoleBroadcastAudioChunk: { receivedChunkCount: 1 },
      commitConsoleBroadcastAudioUpload: { outcome: 'queued' },
    };
    const consoleRpc = createConsoleRpc(async (method, args) => {
      invokedCallList.push({ method, args });
      return resultByMethod[method] ?? null;
    }, 'dashboard-secret');

    const textResult = await consoleRpc.sendBroadcastText('vuelvo a las ocho');
    const beginResult = await consoleRpc.beginBroadcastAudioUpload(48_000, 1);
    const chunkResult = await consoleRpc.appendBroadcastAudioChunk('upload-1', 0, 'abcd');
    const commitResult = await consoleRpc.commitBroadcastAudioUpload('upload-1');

    expect(textResult.outcome).toBe('delivered');
    expect(beginResult.uploadId).toBe('upload-1');
    expect(chunkResult.receivedChunkCount).toBe(1);
    expect(commitResult.outcome).toBe('queued');
    expect(invokedCallList).toEqual([
      {
        method: 'sendConsoleBroadcastText',
        args: [{ secret: 'dashboard-secret', message: 'vuelvo a las ocho' }],
      },
      {
        method: 'beginConsoleBroadcastAudioUpload',
        args: [{ secret: 'dashboard-secret', totalBytes: 48_000, chunkCount: 1 }],
      },
      {
        method: 'appendConsoleBroadcastAudioChunk',
        args: [
          {
            secret: 'dashboard-secret',
            uploadId: 'upload-1',
            chunkIndex: 0,
            base64Chunk: 'abcd',
          },
        ],
      },
      {
        method: 'commitConsoleBroadcastAudioUpload',
        args: [{ secret: 'dashboard-secret', uploadId: 'upload-1' }],
      },
    ]);
  });
});
