import { useCallback, useEffect, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocale, useMessages } from '@/locale/context';
import {
  formatClockTime,
  formatDayTimestamp,
  formatRemainingDuration,
} from '@/locale/format';
import { SCHEDULES_MESSAGE_CATALOG } from '@/schedules/copy';
import { ScheduleComposer } from '@/schedules/create';
import type { ConsoleRpc } from '@/agent/rpc';
import type { Reminder } from '@/agent/schema';
import type { Locale } from '@/locale/detect';

// Mirrors the worker's own timer convention: the "Timer" message prefix plus a
// numeric delay, both required (apps/agent/src/agents/apollo.ts).
function isTimerReminder(reminder: Reminder): boolean {
  return reminder.message.startsWith('Timer') && reminder.delayInSeconds !== undefined;
}

function formatFireTimeLabel(
  firesAtIso: string,
  nowMilliseconds: number,
  locale: Locale,
): string {
  const firesAtDate = new Date(firesAtIso);
  const isSameDay =
    firesAtDate.toDateString() === new Date(nowMilliseconds).toDateString();
  return isSameDay
    ? formatClockTime(firesAtDate, locale)
    : formatDayTimestamp(firesAtDate, locale);
}

export function SchedulesPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const { locale } = useLocale();
  const schedulesMessages = useMessages(SCHEDULES_MESSAGE_CATALOG);
  const [reminderList, setReminderList] = useState<readonly Reminder[] | null>(null);
  const [pendingCancel, setPendingCancel] = useState<Reminder | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshReminderList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setReminderList(await consoleRpc.listReminders());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : schedulesMessages.listFallbackError,
      );
    }
  }, [consoleRpc, schedulesMessages.listFallbackError]);

  useEffect(() => {
    void refreshReminderList();
  }, [refreshReminderList]);

  async function handleConfirmCancel() {
    if (pendingCancel === null) {
      return;
    }
    setIsCancelling(true);
    try {
      setReminderList(await consoleRpc.cancelReminder(pendingCancel.id));
      setPendingCancel(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : schedulesMessages.cancelFallbackError,
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const nowMilliseconds = Date.now();
  const sortedReminderList =
    reminderList === null
      ? null
      : [...reminderList].toSorted((left, right) =>
          left.firesAtIso.localeCompare(right.firesAtIso),
        );

  return (
    <div className="settle space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description={schedulesMessages.pageDescription}>
          {schedulesMessages.pageTitle}
        </Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshReminderList()}>
          {schedulesMessages.refreshLabel}
        </Button>
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
        title={schedulesMessages.panelTitle}
        meta={
          sortedReminderList !== null ? (
            <span className="text-xs text-dim">
              {schedulesMessages.pendingCountLabel(sortedReminderList.length)}
            </span>
          ) : undefined
        }
      >
        <ScheduleComposer
          onCreate={async (message, delaySeconds, isTimer) => {
            setReminderList(
              await consoleRpc.createReminder(message, delaySeconds, isTimer),
            );
          }}
        />

        {sortedReminderList === null ? (
          <ul>
            {[0, 1].map((rowIndex) => (
              <li
                key={rowIndex}
                className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <div className="w-24 shrink-0 space-y-1.5">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-8 w-16" />
              </li>
            ))}
          </ul>
        ) : sortedReminderList.length === 0 ? (
          <Empty message={schedulesMessages.emptyMessage} className="m-4" />
        ) : (
          <ul>
            {sortedReminderList.map((reminder) => (
              <li
                key={reminder.id}
                className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
              >
                <div className="w-24 shrink-0">
                  <p className="text-sm font-medium whitespace-nowrap">
                    {new Date(reminder.firesAtIso).getTime() - nowMilliseconds <= 30_000
                      ? schedulesMessages.dueLabel
                      : formatRemainingDuration(
                          new Date(reminder.firesAtIso).getTime() - nowMilliseconds,
                          locale,
                        )}
                  </p>
                  <p className="mt-0.5 text-xs whitespace-nowrap text-dim">
                    {formatFireTimeLabel(reminder.firesAtIso, nowMilliseconds, locale)}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{reminder.message}</p>
                  <p className="mt-0.5 text-xs text-dim">
                    {isTimerReminder(reminder)
                      ? schedulesMessages.timerKindLabel
                      : schedulesMessages.reminderKindLabel}
                  </p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setPendingCancel(reminder)}
                >
                  {schedulesMessages.cancelLabel}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog
        open={pendingCancel !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setPendingCancel(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{schedulesMessages.cancelDialogTitle}</DialogTitle>
            <DialogDescription>
              {schedulesMessages.cancelDialogDescription(pendingCancel?.message ?? '')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingCancel(null)}>
              {schedulesMessages.keepLabel}
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmCancel()}
              disabled={isCancelling}
            >
              {isCancelling
                ? schedulesMessages.cancellingLabel
                : schedulesMessages.confirmCancelLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
