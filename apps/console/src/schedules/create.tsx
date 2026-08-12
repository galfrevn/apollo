import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

const MAX_DELAY_MINUTES = 1_440;

export function CreateReminderForm({
  onCreate,
}: {
  readonly onCreate: (
    message: string,
    delaySeconds: number,
    isTimer: boolean,
  ) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [delayMinutes, setDelayMinutes] = useState('');
  const [isTimer, setIsTimer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    const parsedMinutes = Number(delayMinutes);
    if (trimmedMessage.length === 0) {
      setErrorMessage(
        isTimer ? 'Give the timer a label.' : 'Write the reminder message.',
      );
      return;
    }
    if (
      !Number.isFinite(parsedMinutes) ||
      parsedMinutes < 1 ||
      parsedMinutes > MAX_DELAY_MINUTES
    ) {
      setErrorMessage(`Minutes must be between 1 and ${MAX_DELAY_MINUTES}.`);
      return;
    }
    setIsCreating(true);
    setErrorMessage(null);
    try {
      await onCreate(trimmedMessage, Math.round(parsedMinutes * 60), isTimer);
      setMessage('');
      setDelayMinutes('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Scheduling failed.');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4" aria-busy={isCreating}>
      <div className="grid gap-4 sm:grid-cols-[2fr_8rem_auto_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="reminder-message">{isTimer ? 'Timer label' : 'Message'}</Label>
          <Input
            id="reminder-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={isTimer ? 'pasta' : 'Sacar la pizza del horno'}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminder-minutes">In minutes</Label>
          <Input
            id="reminder-minutes"
            type="number"
            min={1}
            max={MAX_DELAY_MINUTES}
            value={delayMinutes}
            onChange={(event) => setDelayMinutes(event.target.value)}
            placeholder="15"
            className="font-mono"
          />
        </div>
        <div className="flex items-center gap-2 pb-2.5">
          <Switch
            id="reminder-timer"
            checked={isTimer}
            onCheckedChange={setIsTimer}
            aria-label="Schedule as a timer"
          />
          <Label htmlFor="reminder-timer" className="cursor-pointer">
            Timer
          </Label>
        </div>
        <Button type="submit" disabled={isCreating}>
          {isCreating ? 'Scheduling…' : 'Schedule'}
        </Button>
      </div>
      <p className="text-xs text-faint">
        {isTimer
          ? 'Timers show a countdown arc on the desk and announce when done.'
          : 'The desk speaks the reminder when it fires.'}
      </p>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
