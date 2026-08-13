import { useState } from 'react';

import { Chip } from '@/blueprint/chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SheetTitle } from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useMessages } from '@/locale/context';
import { MCP_MESSAGE_CATALOG, resolveServerStateLabel } from '@/mcp/copy';
import type { McpServer } from '@/agent/schema';
import type { ChipTone } from '@/blueprint/chip';

export function resolveServerTone(state: string): ChipTone {
  if (state === 'ready') {
    return 'live';
  }
  if (state === 'authenticating' || state === 'connecting' || state === 'discovering') {
    return 'busy';
  }
  return 'down';
}

export function ServerDetail({
  server,
  onToggleTool,
  onRetry,
  onUninstall,
}: {
  readonly server: McpServer;
  readonly onToggleTool: (toolName: string, isEnabled: boolean) => Promise<void>;
  readonly onRetry: () => Promise<void>;
  readonly onUninstall: () => Promise<void>;
}) {
  const mcpMessages = useMessages(MCP_MESSAGE_CATALOG);
  const [busyToolName, setBusyToolName] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUninstalling, setIsUninstalling] = useState(false);

  async function handleRetry() {
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleToggle(toolName: string, isEnabled: boolean) {
    setBusyToolName(toolName);
    try {
      await onToggleTool(toolName, isEnabled);
    } finally {
      setBusyToolName(null);
    }
  }

  async function handleUninstall() {
    setIsUninstalling(true);
    try {
      await onUninstall();
    } finally {
      setIsUninstalling(false);
    }
  }

  const enabledCount = server.toolList.filter((tool) => tool.isEnabled).length;

  return (
    <>
      <header className="flex h-[70px] shrink-0 flex-col justify-center gap-1 border-b px-5 pr-14">
        <div className="flex items-center gap-3">
          <SheetTitle className="truncate">{server.name}</SheetTitle>
          <Chip tone={resolveServerTone(server.state)}>
            {resolveServerStateLabel(server.state, mcpMessages)}
          </Chip>
        </div>
        <p className="truncate text-xs text-dim">{server.url}</p>
      </header>

      {server.error !== null && (
        <p
          role="alert"
          className="shrink-0 border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-xs text-destructive"
        >
          {server.error}
        </p>
      )}

      {server.authUrl !== null && (
        <p className="shrink-0 border-b bg-accent px-5 py-2 text-xs text-muted-foreground">
          {mcpMessages.awaitingAuthorizationPrefix}
          <a
            href={server.authUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            {mcpMessages.authorizationLinkLabel}
          </a>
          {mcpMessages.awaitingAuthorizationSuffix}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <p className="border-b px-5 py-2.5 text-xs text-muted-foreground">
          {mcpMessages.toolsEnabledLabel(enabledCount, server.toolList.length)}
        </p>
        {server.toolList.length === 0 ? (
          <p className="dotted-bg px-5 py-8 text-center text-xs text-muted-foreground">
            {mcpMessages.noToolsMessage}
          </p>
        ) : (
          <ul>
            {server.toolList.map((tool) => (
              <li
                key={tool.namespacedName}
                className="space-y-1.5 border-b px-5 py-3 last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <Switch
                    checked={tool.isEnabled}
                    disabled={busyToolName === tool.toolName}
                    onCheckedChange={(isChecked) =>
                      void handleToggle(tool.toolName, isChecked)
                    }
                    aria-label={mcpMessages.toggleToolAriaLabel(
                      tool.isEnabled,
                      tool.toolName,
                    )}
                  />
                  <p className="min-w-0 flex-1 truncate text-sm">{tool.toolName}</p>
                  <Badge variant={tool.safety === 'safe' ? 'outline' : 'destructive'}>
                    {tool.safety === 'safe'
                      ? mcpMessages.safeBadgeLabel
                      : mcpMessages.asksFirstBadgeLabel}
                  </Badge>
                </div>
                {tool.description.length > 0 && (
                  <p className="line-clamp-4 pl-12 text-xs leading-relaxed text-dim">
                    {tool.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="flex shrink-0 gap-2 border-t p-4">
        {server.state !== 'ready' && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => void handleRetry()}
            disabled={isRetrying}
          >
            {isRetrying ? mcpMessages.retryingLabel : mcpMessages.retryLabel}
          </Button>
        )}
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          onClick={() => void handleUninstall()}
          disabled={isUninstalling}
        >
          {isUninstalling ? mcpMessages.uninstallingLabel : mcpMessages.uninstallLabel}
        </Button>
      </footer>
    </>
  );
}
