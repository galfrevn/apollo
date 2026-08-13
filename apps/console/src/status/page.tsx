import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useMessages } from '@/locale/context';
import { STATUS_MESSAGE_CATALOG } from '@/status/copy';
import { Insights } from '@/status/insights';
import { TileGrid } from '@/status/tiles';
import type { ApolloAgentHandle } from '@/agent/hook';
import type { ConsoleRpc } from '@/agent/rpc';
import type { ConsoleStatus } from '@/agent/schema';

const STATUS_POLL_INTERVAL_MS = 10_000;

export function StatusPage({
  agent,
  consoleRpc,
}: {
  readonly agent: ApolloAgentHandle;
  readonly consoleRpc: ConsoleRpc;
}) {
  const statusMessages = useMessages(STATUS_MESSAGE_CATALOG);
  const [status, setStatus] = useState<ConsoleStatus | null>(null);
  const [didPollFail, setDidPollFail] = useState(false);
  const [isResolvingConfirm, setIsResolvingConfirm] = useState(false);

  async function handleResolveConfirm(isApproved: boolean) {
    setIsResolvingConfirm(true);
    try {
      await consoleRpc.confirmPendingAction(isApproved);
    } finally {
      setIsResolvingConfirm(false);
    }
  }

  useEffect(() => {
    let isDisposed = false;
    async function pollStatus() {
      try {
        const nextStatus = await consoleRpc.getStatus();
        if (!isDisposed) {
          setStatus(nextStatus);
          setDidPollFail(false);
        }
      } catch {
        if (!isDisposed) {
          setDidPollFail(true);
        }
      }
    }
    void pollStatus();
    const intervalId = setInterval(() => void pollStatus(), STATUS_POLL_INTERVAL_MS);
    return () => {
      isDisposed = true;
      clearInterval(intervalId);
    };
  }, [consoleRpc]);

  const agentState = agent.state;

  return (
    <div className="settle mx-auto flex max-w-3xl flex-col space-y-8 pt-4 md:min-h-[calc(100dvh-118px)] md:justify-center md:pt-0">
      <Insights agentState={agentState} status={status} />

      {agentState?.pendingConfirmSummary != null && (
        <section className="border bg-card p-5">
          <p className="text-xs text-muted-foreground">
            {statusMessages.awaitingConfirmationLabel}
          </p>
          <p className="mt-2 text-sm">{agentState.pendingConfirmSummary}</p>
          <div className="mt-4 flex gap-2">
            <Button
              size="sm"
              disabled={isResolvingConfirm}
              onClick={() => void handleResolveConfirm(true)}
            >
              {statusMessages.approveLabel}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isResolvingConfirm}
              onClick={() => void handleResolveConfirm(false)}
            >
              {statusMessages.rejectLabel}
            </Button>
          </div>
        </section>
      )}

      {agentState?.caption != null && (
        <p className="text-center text-xs text-dim">“{agentState.caption}”</p>
      )}

      <TileGrid agentState={agentState} status={status} />

      {didPollFail && (
        <p role="alert" className="text-xs text-destructive">
          {statusMessages.pollFailedMessage(STATUS_POLL_INTERVAL_MS / 1000)}
        </p>
      )}
    </div>
  );
}
