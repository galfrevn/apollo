import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';

import '@/platform/bun/shims';

import { createBunDurableStorageShim } from '@/platform/bun/storage';

// Phase 2 spike: MCPClientManager takes a DurableObjectStorage but only ever
// touches sql.exec plus the async kv quartet, so the bun:sqlite shim stands in
// outside a durable object. The import is dynamic because the shims plugin
// must register before the agents module graph loads.
async function createManagerOnSqlite() {
  const { MCPClientManager } = await import('agents/mcp/client');
  const storageShim = createBunDurableStorageShim(new Database(':memory:'));
  // SAFETY: the manager and its OAuth provider use exactly the surface the
  // shim implements (verified against the dist source; pinned by this spec).
  return new MCPClientManager('apollo', '0.0.1', {
    storage: storageShim as DurableObjectStorage,
  });
}

describe('MCPClientManager outside a durable object', () => {
  test('constructs and restores an empty server list from storage', async () => {
    const clientManager = await createManagerOnSqlite();
    await clientManager.restoreConnectionsFromStorage('apollo');
    expect(Object.keys(clientManager.mcpConnections)).toEqual([]);
  });

  test('configureOAuthCallback registers without a durable object host', async () => {
    const clientManager = await createManagerOnSqlite();
    clientManager.configureOAuthCallback({
      successRedirect: 'https://example.com/ok',
      errorRedirect: 'https://example.com/error',
    });
    expect(clientManager.mcpConnections).toEqual({});
  });
});
