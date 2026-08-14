import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

import { SCHEDULES_MESSAGES } from '@/schedules/copy';

const MAX_DELAY_MINUTES = 1_440;
const DELAY_PRESET_MINUTE_LIST = [5, 15, 60] as const;

function formatPresetLabel(presetMinutes: number): string {
  return presetMinutes < 60 ? `${presetMinutes}m` : `${presetMinutes / 60}h`;
}

export function ScheduleComposer({
  onCreate,
}: {
  readonly onCreate: (
    message: string,
    delaySeconds: number,
    isTimer: boolean,
  ) => Promise<void>;
}) {
  const schedulesMessages = SCHEDULES_MESSAGES;
  const [message, setMessage] = useState('');
  const [delayMinutes, setDelayMinutes] = useState('15');
  const [isTimer, setIsTimer] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    const parsedMinutes = Number(delayMinutes);
    if (trimmedMessage.length === 0) {
      setErrorMessage(
        isTimer
          ? schedulesMessages.timerLabelMissingError
          : schedulesMessages.reminderMissingError,
      );
      return;
    }
    if (
      !Number.isFinite(parsedMinutes) ||
      parsedMinutes < 1 ||
      parsedMinutes > MAX_DELAY_MINUTES
    ) {
      setErrorMessage(schedulesMessages.minutesRangeError(MAX_DELAY_MINUTES));
      return;
    }
    setIsCreating(true);
    setErrorMessage(null);
    try {
      await onCreate(trimmedMessage, Math.round(parsedMinutes * 60), isTimer);
      setMessage('');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : schedulesMessages.schedulingFallbackError,
      );
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-2 border-b p-3"
      aria-busy={isCreating}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={
            isTimer
              ? schedulesMessages.timerPlaceholder
              : schedulesMessages.reminderPlaceholder
          }
          aria-label={
            isTimer
              ? schedulesMessages.timerInputAriaLabel
              : schedulesMessages.reminderInputAriaLabel
          }
          className="h-8 min-w-48 flex-1 text-sm"
        />
        <div className="flex items-center gap-1">
          {DELAY_PRESET_MINUTE_LIST.map((presetMinutes) => (
            <Button
              key={presetMinutes}
              type="button"
              size="sm"
              variant={delayMinutes === String(presetMinutes) ? 'default' : 'outline'}
              className="h-8 px-2.5"
              onClick={() => setDelayMinutes(String(presetMinutes))}
            >
              {formatPresetLabel(presetMinutes)}
            </Button>
          ))}
          <Input
            type="number"
            min={1}
            max={MAX_DELAY_MINUTES}
            value={delayMinutes}
            onChange={(event) => setDelayMinutes(event.target.value)}
            aria-label={schedulesMessages.minutesInputAriaLabel}
            className="h-8 w-16 text-xs"
          />
          <span className="text-xs text-dim">{schedulesMessages.minutesUnitLabel}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <Switch
            checked={isTimer}
            onCheckedChange={setIsTimer}
            aria-label={schedulesMessages.timerSwitchAriaLabel}
          />
          <span className="text-xs font-medium text-muted-foreground">
            {schedulesMessages.timerSwitchLabel}
          </span>
        </label>
        <Button type="submit" size="sm" disabled={isCreating}>
          {isCreating ? schedulesMessages.addingLabel : schedulesMessages.addLabel}
        </Button>
      </div>
      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </form>
  );
}
