import { useCallback, useEffect, useState } from 'react';

import { Chip } from '@/blueprint/chip';
import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/utility';
import { useMessages } from '@/locale/context';
import { ConnectorCatalog } from '@/mcp/catalog';
import { MCP_MESSAGE_CATALOG, resolveServerStateLabel } from '@/mcp/copy';
import { InstallForm } from '@/mcp/install';
import { ServerDetail, resolveServerTone } from '@/mcp/server';
import type { ConsoleRpc } from '@/agent/rpc';
import type { McpServer } from '@/agent/schema';
import type { ConnectorDefinition } from '@/mcp/catalog';

function normalizeServerUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl).href;
  } catch {
    return rawUrl;
  }
}

function ServerCard({
  server,
  onOpen,
}: {
  readonly server: McpServer;
  readonly onOpen: () => void;
}) {
  const mcpMessages = useMessages(MCP_MESSAGE_CATALOG);
  const enabledCount = server.toolList.filter((tool) => tool.isEnabled).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-[110px] flex-col justify-between gap-3 border bg-card p-5 text-left transition-all duration-300 hover:border-border-hover hover:bg-card-hover"
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className="truncate text-sm font-medium">{server.name}</span>
        <Chip tone={resolveServerTone(server.state)}>
          {resolveServerStateLabel(server.state, mcpMessages)}
        </Chip>
      </div>
      <div className="w-full">
        <p className="truncate text-xs text-dim">{server.url}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {mcpMessages.toolsOnLabel(enabledCount, server.toolList.length)}
          {server.authUrl !== null && mcpMessages.needsAuthorizationSuffix}
        </p>
      </div>
    </button>
  );
}

export function McpPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const mcpMessages = useMessages(MCP_MESSAGE_CATALOG);
  const [serverList, setServerList] = useState<readonly McpServer[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isInstallDialogOpen, setIsInstallDialogOpen] = useState(false);
  const [installPrefill, setInstallPrefill] = useState<ConnectorDefinition | null>(null);
  const [busyConnectorUrl, setBusyConnectorUrl] = useState<string | null>(null);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);

  const refreshServerList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setServerList(await consoleRpc.listMcpServers());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : mcpMessages.listServersFallbackError,
      );
    }
  }, [consoleRpc, mcpMessages.listServersFallbackError]);

  useEffect(() => {
    void refreshServerList();
  }, [refreshServerList]);

  const selectedServer =
    serverList?.find((server) => server.serverId === selectedServerId) ?? null;
  const installedUrlSet = new Set(
    (serverList ?? []).map((server) => normalizeServerUrl(server.url)),
  );

  async function handleInstallConnector(connector: ConnectorDefinition) {
    if (connector.auth === 'token') {
      setInstallPrefill(connector);
      setIsInstallDialogOpen(true);
      return;
    }
    setBusyConnectorUrl(connector.url);
    setErrorMessage(null);
    try {
      const installResult = await consoleRpc.installMcpServer(
        connector.name,
        connector.url,
      );
      await refreshServerList();
      setSelectedServerId(installResult.serverId);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : mcpMessages.installRetryFallbackError,
      );
    } finally {
      setBusyConnectorUrl(null);
    }
  }

  return (
    <div
      className={cn(
        'settle space-y-5 lg:transition-[margin-right] lg:duration-[400ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)]',
        selectedServer !== null && 'lg:mr-[calc(100vw/3)]',
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description={mcpMessages.pageDescription}>
          {mcpMessages.pageTitle}
        </Heading>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void refreshServerList()}>
            {mcpMessages.refreshLabel}
          </Button>
          <Button size="sm" onClick={() => setIsInstallDialogOpen(true)}>
            {mcpMessages.installServerLabel}
          </Button>
        </div>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </p>
      )}

      {serverList === null ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((cardIndex) => (
            <div
              key={cardIndex}
              className="flex min-h-[110px] flex-col justify-between gap-3 border bg-card p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-16" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : serverList.length === 0 ? (
        <Empty message={mcpMessages.noServersMessage} className="min-h-40" />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {serverList.map((server) => (
            <ServerCard
              key={server.serverId}
              server={server}
              onOpen={() => setSelectedServerId(server.serverId)}
            />
          ))}
        </div>
      )}

      <ConnectorCatalog
        installedUrlSet={installedUrlSet}
        busyConnectorUrl={busyConnectorUrl}
        onInstallConnector={(connector) => void handleInstallConnector(connector)}
      />

      <Dialog
        open={isInstallDialogOpen}
        onOpenChange={(isOpen) => {
          setIsInstallDialogOpen(isOpen);
          if (!isOpen) {
            setInstallPrefill(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mcpMessages.installDialogTitle}</DialogTitle>
          </DialogHeader>
          <InstallForm
            key={installPrefill?.url ?? 'blank'}
            initialName={installPrefill?.name}
            initialUrl={installPrefill?.url}
            onInstall={async (name, url, authToken) => {
              const installResult = await consoleRpc.installMcpServer(
                name,
                url,
                authToken,
              );
              await refreshServerList();
              return installResult;
            }}
            onInstalled={(installResult) => {
              if (installResult.authUrl === null) {
                setIsInstallDialogOpen(false);
              }
            }}
          />
        </DialogContent>
      </Dialog>

      <Sheet
        open={selectedServer !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedServerId(null);
          }
        }}
      >
        <SheetContent aria-describedby={undefined}>
          {selectedServer !== null && (
            <ServerDetail
              server={selectedServer}
              onRetry={async () => {
                setServerList(await consoleRpc.retryMcpServer(selectedServer.serverId));
              }}
              onToggleTool={async (toolName, isEnabled) => {
                setServerList(
                  await consoleRpc.setToolEnabled(
                    selectedServer.serverId,
                    toolName,
                    isEnabled,
                  ),
                );
              }}
              onUninstall={async () => {
                setServerList(
                  await consoleRpc.uninstallMcpServer(selectedServer.serverId),
                );
                setSelectedServerId(null);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
