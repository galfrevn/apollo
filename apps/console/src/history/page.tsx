import { useCallback, useEffect, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/utility';
import type { ConsoleRpc } from '@/agent/rpc';
import type { HistoryTurn } from '@/agent/schema';

export function HistoryPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [turnList, setTurnList] = useState<readonly HistoryTurn[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshHistory = useCallback(async () => {
    setErrorMessage(null);
    try {
      setTurnList(await consoleRpc.listHistory());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load the history.',
      );
    }
  }, [consoleRpc]);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  return (
    <div className="settle space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description="Recent voice turns between the owner and the agent">
          History
        </Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshHistory()}>
          Refresh
        </Button>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-dangerdim px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </p>
      )}

      <Panel
        title="Conversation"
        meta={
          turnList !== null ? (
            <span className="text-xs text-faint">{turnList.length} turns</span>
          ) : undefined
        }
      >
        {turnList === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : turnList.length === 0 ? (
          <Empty message="No conversation yet — talk to the desk" className="m-4" />
        ) : (
          <ol className="space-y-3 p-4">
            {turnList.map((turn) => (
              <li
                key={turn.id}
                className={cn(
                  'flex',
                  turn.role === 'assistant' ? 'justify-start' : 'justify-end',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg border px-3 py-2 sm:max-w-[70%]',
                    turn.role === 'assistant'
                      ? 'border-line bg-raised'
                      : 'border-amber/30 bg-amberdim',
                  )}
                >
                  <p className="label-soft mb-1 text-faint">
                    {turn.role === 'assistant' ? 'Apollo' : 'Owner'}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <p className="text-xs text-faint">
        Voice turns only — tool calls are not recorded in the session today.
      </p>
    </div>
  );
}
