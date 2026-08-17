import type { Database } from 'bun:sqlite';
import type { MCPClientManager } from 'agents/mcp/client';

import { buildMcpOauthLandingResponse } from '@/mcp/landing';
import type { McpServerRecordCandidateMap } from '@/mcp/servers';
import { createBunDurableStorageShim } from '@/platform/bun/storage';

export type HostMcpAddServerResult = {
  readonly serverId: string;
  readonly state: string;
  readonly authUrl: string | null;
};

export type HostMcpManager = {
  readonly manager: MCPClientManager;
  addServer(input: {
    readonly name: string;
    readonly url: string;
    readonly authToken?: string;
    readonly callbackHost: string;
  }): Promise<HostMcpAddServerResult>;
  buildServerRecordMap(): McpServerRecordCandidateMap;
  handleOauthCallback(request: Request): Promise<Response | null>;
};

// The durable object gets all of this from the Agent base class; the host
// drives MCPClientManager directly over the bun:sqlite storage shim. The
// import is dynamic because the agents mcp module graph must load after the
// cloudflare:workers stub plugin registers.
export async function createHostMcpManager(input: {
  readonly database: Database;
  readonly deviceName: string;
  readonly onServersChanged: () => void;
}): Promise<HostMcpManager> {
  const { MCPClientManager } = await import('agents/mcp/client');
  const { DurableObjectOAuthClientProvider } =
    await import('agents/mcp/do-oauth-client-provider');
  const storageShim = createBunDurableStorageShim(input.database);
  // SAFETY: the manager and its OAuth provider use exactly the sql.exec +
  // kv get/put/delete/list surface the shim implements, pinned by the
  // platform/bun mcp spec.
  const durableStorage = storageShim as DurableObjectStorage;
  const manager = new MCPClientManager('apollo', '0.0.1', {
    storage: durableStorage,
    createAuthProvider: (callbackUrl) =>
      new DurableObjectOAuthClientProvider(durableStorage, input.deviceName, callbackUrl),
  });
  manager.configureOAuthCallback({
    customHandler: (callbackResult) => buildMcpOauthLandingResponse(callbackResult),
  });
  manager.onServerStateChanged(() => {
    input.onServersChanged();
  });
  await manager.restoreConnectionsFromStorage(input.deviceName);

  async function addServer(serverInput: {
    readonly name: string;
    readonly url: string;
    readonly authToken?: string;
    readonly callbackHost: string;
  }): Promise<HostMcpAddServerResult> {
    const normalizedUrl = new URL(serverInput.url).href;
    const existingServer = manager
      .listServers()
      .find(
        (server) =>
          server.name === serverInput.name &&
          new URL(server.server_url).href === normalizedUrl,
      );
    const serverId = existingServer?.id ?? crypto.randomUUID().slice(0, 8);
    const callbackUrl = `${serverInput.callbackHost.replace(/\/$/, '')}/agents/apollo/${input.deviceName}/callback`;
    const authProvider = new DurableObjectOAuthClientProvider(
      durableStorage,
      input.deviceName,
      callbackUrl,
    );
    authProvider.serverId = serverId;
    const headerTransportOptions =
      serverInput.authToken === undefined
        ? {}
        : {
            requestInit: {
              headers: { Authorization: `Bearer ${serverInput.authToken}` },
            },
          };
    await manager.registerServer(serverId, {
      url: normalizedUrl,
      name: serverInput.name,
      callbackUrl,
      transport: {
        ...headerTransportOptions,
        authProvider,
        type: 'auto',
      },
    });
    const connectResult = await manager.connectToServer(serverId);
    if (connectResult.state === 'failed') {
      throw new Error(
        `Failed to connect to MCP server at ${normalizedUrl}: ${connectResult.error}`,
      );
    }
    if (connectResult.state === 'authenticating') {
      return {
        serverId,
        state: connectResult.state,
        authUrl: connectResult.authUrl ?? null,
      };
    }
    const discoverResult = await manager.discoverIfConnected(serverId);
    if (discoverResult !== undefined && !discoverResult.success) {
      throw new Error(
        `Failed to discover MCP server capabilities: ${discoverResult.error}`,
      );
    }
    return { serverId, state: 'ready', authUrl: null };
  }

  function buildServerRecordMap(): McpServerRecordCandidateMap {
    const serverRecordMap: McpServerRecordCandidateMap = {};
    for (const server of manager.listServers()) {
      const serverConnection = manager.mcpConnections[server.id];
      serverRecordMap[server.id] = {
        auth_url: server.auth_url,
        error: serverConnection?.connectionError ?? null,
        name: server.name,
        server_url: server.server_url,
        state:
          serverConnection?.connectionState ??
          (server.auth_url ? 'authenticating' : 'not-connected'),
      };
    }
    return serverRecordMap;
  }

  async function handleOauthCallback(request: Request): Promise<Response | null> {
    if (!manager.isCallbackRequest(request)) {
      return null;
    }
    const callbackResult = await manager.handleCallbackRequest(request);
    if (callbackResult.authSuccess) {
      manager.establishConnection(callbackResult.serverId).catch((error: unknown) => {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'host_mcp_establish_failed',
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      });
    }
    input.onServersChanged();
    return buildMcpOauthLandingResponse(callbackResult);
  }

  return { manager, addServer, buildServerRecordMap, handleOauthCallback };
}
