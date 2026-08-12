import { useState } from 'react';

import { Chip } from '@/blueprint/chip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { McpServer } from '@/agent/schema';
import type { ChipTone } from '@/blueprint/chip';

function resolveServerTone(state: string): ChipTone {
  if (state === 'ready') {
    return 'live';
  }
  if (state === 'authenticating' || state === 'connecting' || state === 'discovering') {
    return 'busy';
  }
  return 'down';
}

export function ServerCard({
  server,
  onToggleTool,
  onUninstall,
}: {
  readonly server: McpServer;
  readonly onToggleTool: (toolName: string, isEnabled: boolean) => Promise<void>;
  readonly onUninstall: () => Promise<void>;
}) {
  const [busyToolName, setBusyToolName] = useState<string | null>(null);
  const [isUninstalling, setIsUninstalling] = useState(false);

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
    <article className="overflow-hidden rounded-xl border border-line bg-panel">
      <header className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <h3 className="text-sm font-semibold">{server.name}</h3>
        <Chip tone={resolveServerTone(server.state)}>{server.state}</Chip>
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-faint">
          {server.url}
        </span>
        <span className="text-xs text-faint">
          {enabledCount}/{server.toolList.length} tools on
        </span>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => void handleUninstall()}
          disabled={isUninstalling}
        >
          {isUninstalling ? 'Removing…' : 'Uninstall'}
        </Button>
      </header>

      {server.error !== null && (
        <p
          role="alert"
          className="border-b border-danger/40 bg-dangerdim px-4 py-2 text-xs text-danger"
        >
          {server.error}
        </p>
      )}

      {server.authUrl !== null && (
        <p className="border-b border-amber/40 bg-amberdim px-4 py-2 text-xs text-amber">
          Awaiting authorization —{' '}
          <a
            href={server.authUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            open the auth page
          </a>
          , then refresh.
        </p>
      )}

      {server.toolList.length === 0 ? (
        <p className="pixelfield px-4 py-6 text-center text-xs text-faint">
          No tools discovered yet
        </p>
      ) : (
        <ul>
          {server.toolList.map((tool) => (
            <li
              key={tool.namespacedName}
              className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
            >
              <Switch
                checked={tool.isEnabled}
                disabled={busyToolName === tool.toolName}
                onCheckedChange={(isChecked) =>
                  void handleToggle(tool.toolName, isChecked)
                }
                aria-label={`${tool.isEnabled ? 'Disable' : 'Enable'} ${tool.toolName}`}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-sm">{tool.toolName}</p>
                {tool.description.length > 0 && (
                  <p className="truncate text-xs text-faint">{tool.description}</p>
                )}
              </div>
              <Badge variant={tool.safety === 'safe' ? 'outline' : 'danger'}>
                {tool.safety === 'safe' ? 'Safe' : 'Asks first'}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
