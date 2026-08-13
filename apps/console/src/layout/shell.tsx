import { useMemo, useState, useSyncExternalStore } from 'react';

import { useApolloAgent } from '@/agent/hook';
import { createConsoleRpc } from '@/agent/rpc';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/utility';
import { useConnection } from '@/connection/context';
import { DevicePage } from '@/device/page';
import { HistoryPage } from '@/history/page';
import { JobsPage } from '@/jobs/page';
import { Nav } from '@/layout/nav';
import { Search } from '@/layout/search';
import { McpPage } from '@/mcp/page';
import { MemoryPage } from '@/memory/page';
import { useConsoleRoute } from '@/router/route';
import { useDocumentMetadata } from '@/router/metadata';
import { SchedulesPage } from '@/schedules/page';
import { StatusPage } from '@/status/page';
import type { ApolloAgentHandle } from '@/agent/hook';
import type { ConsoleConnection } from '@/connection/schema';

function useSocketReadyState(agent: ApolloAgentHandle): number {
  return useSyncExternalStore(
    (onChange) => {
      agent.addEventListener('open', onChange);
      agent.addEventListener('close', onChange);
      agent.addEventListener('error', onChange);
      return () => {
        agent.removeEventListener('open', onChange);
        agent.removeEventListener('close', onChange);
        agent.removeEventListener('error', onChange);
      };
    },
    () => agent.readyState,
  );
}

export function Shell({ connection }: { readonly connection: ConsoleConnection }) {
  const { disconnect } = useConnection();
  const agent = useApolloAgent(connection);
  const activeRoute = useConsoleRoute();
  useDocumentMetadata(activeRoute);
  const [isRailExpanded, setIsRailExpanded] = useState(false);
  const socketReadyState = useSocketReadyState(agent);
  const consoleRpc = useMemo(
    () => createConsoleRpc((method, args) => agent.call(method, args), connection.secret),
    [agent, connection.secret],
  );

  const isSocketOpen = socketReadyState === WebSocket.OPEN;
  const isUnauthorized = agent.connectionError !== null;

  return (
    <div className="min-h-dvh">
      <div
        className={cn(
          'transition-[margin-left] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isRailExpanded ? 'md:ml-60' : 'md:ml-[70px]',
        )}
      >
        <header className="sticky top-0 z-40 flex h-[70px] items-center justify-between gap-4 border-b bg-background/70 px-4 backdrop-blur-xl md:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <span className="flex items-center md:hidden">
              <Icons.LogoMark size={20} />
            </span>
            <Search />
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <span role="status" className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className={cn(
                  'size-1.5 rounded-full',
                  isSocketOpen
                    ? 'animate-[signal_2s_ease-in-out_infinite] bg-foreground'
                    : isUnauthorized
                      ? 'bg-destructive'
                      : 'animate-[signal_1s_ease-in-out_infinite] bg-dim',
                )}
              />
              <span
                className={cn(
                  isUnauthorized ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {isSocketOpen
                  ? 'Connected'
                  : isUnauthorized
                    ? 'Unauthorized'
                    : 'Connecting…'}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={disconnect}>
              <Icons.Logout size={16} />
              <span className="hidden sm:inline">Disconnect</span>
            </Button>
          </div>
        </header>

        {isUnauthorized && (
          <div
            role="alert"
            className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive"
          >
            The worker refused this connection — the dashboard secret is likely wrong.
            Disconnect and enter it again.
          </div>
        )}

        <Nav isRailExpanded={isRailExpanded} onRailExpandedChange={setIsRailExpanded} />

        <main className="px-4 py-6 md:px-8">
          {activeRoute === 'status' && (
            <StatusPage agent={agent} consoleRpc={consoleRpc} />
          )}
          {activeRoute === 'device' && (
            <DevicePage agent={agent} consoleRpc={consoleRpc} />
          )}
          {activeRoute === 'mcp' && <McpPage consoleRpc={consoleRpc} />}
          {activeRoute === 'memory' && <MemoryPage consoleRpc={consoleRpc} />}
          {activeRoute === 'schedules' && <SchedulesPage consoleRpc={consoleRpc} />}
          {activeRoute === 'history' && <HistoryPage consoleRpc={consoleRpc} />}
          {activeRoute === 'jobs' && <JobsPage consoleRpc={consoleRpc} />}
        </main>
      </div>
    </div>
  );
}
