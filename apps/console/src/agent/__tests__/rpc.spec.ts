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
});
