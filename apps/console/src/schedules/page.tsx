import { useCallback, useEffect, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ConsoleRpc } from '@/agent/rpc';
import type { Reminder } from '@/agent/schema';

function isTimerReminder(reminder: Reminder): boolean {
  return reminder.delayInSeconds !== undefined;
}

function formatRemainingLabel(firesAtIso: string, nowMilliseconds: number): string {
  const remainingMinutes = Math.round(
    (new Date(firesAtIso).getTime() - nowMilliseconds) / 60_000,
  );
  if (remainingMinutes <= 0) {
    return 'due';
  }
  if (remainingMinutes < 90) {
    return `in ${remainingMinutes} min`;
  }
  if (remainingMinutes < 48 * 60) {
    return `in ${Math.round(remainingMinutes / 60)} h`;
  }
  return `in ${Math.round(remainingMinutes / (24 * 60))} d`;
}

export function SchedulesPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
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
        error instanceof Error ? error.message : 'Could not list reminders.',
      );
    }
  }, [consoleRpc]);

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
        error instanceof Error ? error.message : 'Cancel failed — refresh and retry.',
      );
    } finally {
      setIsCancelling(false);
    }
  }

  const nowMilliseconds = Date.now();

  return (
    <div className="settle space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description="What the desk will say, and when">Schedules</Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshReminderList()}>
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
        title="Reminders & timers"
        meta={
          reminderList !== null ? (
            <span className="text-xs text-faint">{reminderList.length} pending</span>
          ) : undefined
        }
      >
        {reminderList === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : reminderList.length === 0 ? (
          <Empty message="Nothing scheduled" className="m-4" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="sr-only">
                <tr>
                  <th>Type</th>
                  <th>Message</th>
                  <th>Fires</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reminderList.map((reminder) => (
                  <tr key={reminder.id} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pl-4">
                      <Badge variant={isTimerReminder(reminder) ? 'amber' : 'outline'}>
                        {isTimerReminder(reminder) ? 'Timer' : 'Reminder'}
                      </Badge>
                    </td>
                    <td className="w-full px-4 py-2.5 text-sm">{reminder.message}</td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted">
                      <span className="whitespace-nowrap">
                        {formatRemainingLabel(reminder.firesAtIso, nowMilliseconds)}
                      </span>
                      <span className="mt-0.5 block text-faint">
                        {new Date(reminder.firesAtIso).toLocaleString()}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setPendingCancel(reminder)}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <DialogTitle>Cancel this reminder?</DialogTitle>
            <DialogDescription>
              “{pendingCancel?.message}” will not fire on the desk.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingCancel(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmCancel()}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling…' : 'Cancel reminder'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
