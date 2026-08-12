import { useCallback, useEffect, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Button } from '@/components/ui/button';
import { InstallForm } from '@/mcp/install';
import { ServerCard } from '@/mcp/server';
import type { ConsoleRpc } from '@/agent/rpc';
import type { McpServer } from '@/agent/schema';

export function McpPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [serverList, setServerList] = useState<readonly McpServer[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshServerList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setServerList(await consoleRpc.listMcpServers());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not list MCP servers.',
      );
    }
  }, [consoleRpc]);

  useEffect(() => {
    void refreshServerList();
  }, [refreshServerList]);

  return (
    <div className="settle space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description="Servers and tools the agent may use">MCP</Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshServerList()}>
          Refresh
        </Button>
      </div>

      <Panel title="Install a server">
        <InstallForm
          onInstall={async (name, url) => {
            const installResult = await consoleRpc.installMcpServer(name, url);
            await refreshServerList();
            return installResult;
          }}
        />
      </Panel>

      {errorMessage !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-dangerdim px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </p>
      )}

      {serverList === null ? (
        <p className="text-sm text-muted">Loading servers…</p>
      ) : serverList.length === 0 ? (
        <Empty message="No MCP servers installed" className="min-h-40" />
      ) : (
        <div className="space-y-4">
          {serverList.map((server) => (
            <ServerCard
              key={server.serverId}
              server={server}
              onToggleTool={async (toolName, isEnabled) => {
                setServerList(
                  await consoleRpc.setToolEnabled(server.serverId, toolName, isEnabled),
                );
              }}
              onUninstall={async () => {
                setServerList(await consoleRpc.uninstallMcpServer(server.serverId));
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
