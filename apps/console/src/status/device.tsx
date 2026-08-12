import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ConsoleRpc } from '@/agent/rpc';

function CommandRow({
  label,
  inputId,
  onApply,
}: {
  readonly label: string;
  readonly inputId: string;
  readonly onApply: (value: number) => Promise<string>;
}) {
  const [value, setValue] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const parsedValue = Number(value);
    if (!Number.isInteger(parsedValue) || parsedValue < 0 || parsedValue > 100) {
      setFeedback('Use a whole number from 0 to 100.');
      return;
    }
    setIsApplying(true);
    setFeedback(null);
    try {
      setFeedback(await onApply(parsedValue));
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Command failed.');
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2" aria-busy={isApplying}>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor={inputId}>{label}</Label>
        <Input
          id={inputId}
          type="number"
          min={0}
          max={100}
          placeholder="0–100"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono"
        />
        {feedback !== null && <p className="text-xs text-muted">{feedback}</p>}
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={isApplying}>
        Apply
      </Button>
    </form>
  );
}

export function DeviceControls({
  consoleRpc,
  isDeviceConnected,
}: {
  readonly consoleRpc: ConsoleRpc;
  readonly isDeviceConnected: boolean;
}) {
  if (!isDeviceConnected) {
    return (
      <p className="px-4 pb-4 text-xs text-faint">
        Controls appear when the desk is online.
      </p>
    );
  }
  return (
    <div className="space-y-4 px-4 pb-4">
      <CommandRow
        label="Volume"
        inputId="device-volume"
        onApply={async (volume) => (await consoleRpc.setDeviceVolume(volume)).summary}
      />
      <CommandRow
        label="Brightness"
        inputId="device-brightness"
        onApply={async (brightness) =>
          (await consoleRpc.setDeviceBrightness(brightness)).summary
        }
      />
    </div>
  );
}
