import { useCallback, useEffect, useRef, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/utility';
import type { ConsoleRpc } from '@/agent/rpc';
import type { HistoryTurn, ThreadSummary } from '@/agent/schema';

type HistoryView = 'conversations' | 'commands';

function isCommandThread(thread: ThreadSummary): boolean {
  return thread.kind === 'command';
}

function formatThreadTimestamp(lastTurnAtIso: string | null): string | null {
  return lastTurnAtIso === null ? null : new Date(lastTurnAtIso).toLocaleString();
}

export function HistoryPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [threadList, setThreadList] = useState<readonly ThreadSummary[] | null>(null);
  const [activeView, setActiveView] = useState<HistoryView>('conversations');
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [openThreadTurnList, setOpenThreadTurnList] = useState<
    readonly HistoryTurn[] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const openThreadIdRef = useRef<string | null>(null);

  const refreshThreadList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setThreadList(await consoleRpc.listThreads());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not load the history.',
      );
    }
  }, [consoleRpc]);

  useEffect(() => {
    void refreshThreadList();
  }, [refreshThreadList]);

  async function handleOpenThread(threadId: string) {
    openThreadIdRef.current = threadId;
    setOpenThreadId(threadId);
    setOpenThreadTurnList(null);
    let loadedTurnList: readonly HistoryTurn[] = [];
    try {
      loadedTurnList = await consoleRpc.getThread(threadId);
    } catch {
      loadedTurnList = [];
    }
    if (openThreadIdRef.current === threadId) {
      setOpenThreadTurnList(loadedTurnList);
    }
  }

  function handleCloseThread() {
    openThreadIdRef.current = null;
    setOpenThreadId(null);
    setOpenThreadTurnList(null);
  }

  const visibleThreadList =
    threadList === null
      ? null
      : threadList.filter((thread) =>
          activeView === 'commands' ? isCommandThread(thread) : !isCommandThread(thread),
        );
  const openThread = threadList?.find((thread) => thread.id === openThreadId) ?? null;

  return (
    <div
      className={cn(
        'settle space-y-5 lg:transition-[margin-right] lg:duration-[400ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)]',
        openThreadId !== null && 'lg:mr-[calc(100vw/3)]',
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description="Conversation threads between the owner and the agent">
          History
        </Heading>
        <div className="flex items-center gap-2">
          <Button
            variant={activeView === 'conversations' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('conversations')}
          >
            Conversations
          </Button>
          <Button
            variant={activeView === 'commands' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveView('commands')}
          >
            Commands
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refreshThreadList()}>
            Refresh
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

      <Panel
        title={activeView === 'commands' ? 'Command log' : 'Conversations'}
        meta={
          visibleThreadList !== null ? (
            <span className="text-xs text-dim">{visibleThreadList.length} threads</span>
          ) : undefined
        }
      >
        {visibleThreadList === null ? (
          <ul>
            {[0, 1, 2].map((rowIndex) => (
              <li
                key={rowIndex}
                className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
              >
                <Skeleton className="h-5 w-[4.5rem]" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3.5 w-44" />
              </li>
            ))}
          </ul>
        ) : visibleThreadList.length === 0 ? (
          <Empty
            message={
              activeView === 'commands'
                ? 'No quick commands yet — ask the desk for a timer or the weather'
                : 'No conversations yet — talk to the desk'
            }
            className="m-4"
          />
        ) : (
          <ul>
            {visibleThreadList.map((thread) => (
              <li key={thread.id} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => void handleOpenThread(thread.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-card-hover',
                    openThreadId === thread.id && 'bg-active',
                  )}
                >
                  <Badge variant={thread.isActive ? 'strong' : 'outline'}>
                    {thread.isActive
                      ? 'active'
                      : thread.kind === 'pending'
                        ? 'open'
                        : thread.kind}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-sm">{thread.title}</span>
                    {thread.summary !== null && (
                      <span className="ml-2 text-xs text-dim">{thread.summary}</span>
                    )}
                  </span>
                  {formatThreadTimestamp(thread.lastTurnAtIso) !== null && (
                    <span className="shrink-0 text-xs whitespace-nowrap text-dim">
                      {formatThreadTimestamp(thread.lastTurnAtIso)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <p className="text-xs text-dim">
        Threads close after 30 minutes of silence; conversations get a title and summary,
        quick commands land in the command log. Tool calls show as chips on the turn that
        ran them.
      </p>

      <Sheet
        open={openThreadId !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleCloseThread();
          }
        }}
      >
        <SheetContent aria-describedby={undefined}>
          <header className="flex h-[70px] shrink-0 flex-col justify-center gap-1 border-b px-5 pr-14">
            <SheetTitle className="truncate">{openThread?.title ?? 'Thread'}</SheetTitle>
            {openThread !== null && openThread.summary !== null && (
              <p className="truncate text-xs text-dim">{openThread.summary}</p>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {openThreadTurnList === null ? (
              <ol className="space-y-3">
                <li className="flex justify-end">
                  <Skeleton className="h-14 w-1/2" />
                </li>
                <li className="flex justify-start">
                  <Skeleton className="h-16 w-2/3" />
                </li>
                <li className="flex justify-end">
                  <Skeleton className="h-10 w-2/5" />
                </li>
              </ol>
            ) : openThreadTurnList.length === 0 ? (
              <Empty message="No turns recorded in this thread" />
            ) : (
              <ol className="space-y-3">
                {openThreadTurnList.map((turn) => (
                  <li
                    key={turn.id}
                    className={cn(
                      'flex',
                      turn.role === 'assistant' ? 'justify-start' : 'justify-end',
                    )}
                  >
                    <div
                      className={cn(
                        'max-w-[85%] border px-3 py-2',
                        turn.role === 'assistant' ? 'bg-card' : 'bg-accent',
                      )}
                    >
                      <p className="mb-1 text-xs font-medium text-dim">
                        {turn.role === 'assistant' ? 'Apollo' : 'Owner'}
                        {turn.createdAtIso !== null &&
                          ` · ${new Date(turn.createdAtIso).toLocaleTimeString()}`}
                      </p>
                      <p className="text-sm whitespace-pre-wrap">{turn.text}</p>
                      {turn.toolNameList.length > 0 && (
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {turn.toolNameList.map((toolName, toolIndex) => (
                            <Badge key={`${turn.id}-${toolIndex}`} variant="outline">
                              {toolName}
                            </Badge>
                          ))}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
