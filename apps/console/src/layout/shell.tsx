import { useMemo, useSyncExternalStore } from 'react';

import { useApolloAgent } from '@/agent/hook';
import { createConsoleRpc } from '@/agent/rpc';
import { Chip } from '@/blueprint/chip';
import { Button } from '@/components/ui/button';
import { useConnection } from '@/connection/context';
import { Nav } from '@/layout/nav';
import { McpPage } from '@/mcp/page';
import { MemoryPage } from '@/memory/page';
import { useConsoleRoute } from '@/router/hash';
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
  const socketReadyState = useSocketReadyState(agent);
  const consoleRpc = useMemo(
    () => createConsoleRpc((method, args) => agent.call(method, args), connection.secret),
    [agent, connection.secret],
  );

  const isSocketOpen = socketReadyState === WebSocket.OPEN;
  const isUnauthorized = agent.connectionError !== null;

  return (
    <div className="min-h-dvh">
      <header className="flex h-14 items-center justify-between border-b border-line bg-panel/70 px-4 backdrop-blur-sm lg:px-6">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="grid grid-cols-2 gap-0.5">
            <span className="size-1.5 bg-amber" />
            <span className="size-1.5 bg-amber/40" />
            <span className="size-1.5 bg-amber/40" />
            <span className="size-1.5 bg-amber/15" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em]">Apollo Console</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden font-mono text-xs text-faint sm:inline">
            {connection.deviceName} @ {new URL(connection.workerUrl).host}
          </span>
          <Chip tone={isSocketOpen ? 'live' : isUnauthorized ? 'down' : 'busy'}>
            {isSocketOpen ? 'Link up' : isUnauthorized ? 'Unauthorized' : 'Linking'}
          </Chip>
          <Button variant="ghost" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      </header>

      {isUnauthorized && (
        <div
          role="alert"
          className="border-b border-danger/40 bg-dangerdim px-4 py-2 text-xs text-danger"
        >
          The worker refused this connection — the dashboard secret is likely wrong.
          Disconnect and enter it again.
        </div>
      )}

      <div className="lg:grid lg:grid-cols-[12rem_1fr]">
        <Nav />
        <main className="min-w-0 p-4 lg:p-6">
          {activeRoute === 'status' && (
            <StatusPage agent={agent} consoleRpc={consoleRpc} />
          )}
          {activeRoute === 'mcp' && <McpPage consoleRpc={consoleRpc} />}
          {activeRoute === 'memory' && <MemoryPage consoleRpc={consoleRpc} />}
          {activeRoute === 'schedules' && <SchedulesPage consoleRpc={consoleRpc} />}
        </main>
      </div>
    </div>
  );
}
