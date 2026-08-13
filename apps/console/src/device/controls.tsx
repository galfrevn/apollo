import { useEffect, useState } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { DEVICE_MESSAGE_CATALOG } from '@/device/copy';
import { useMessages } from '@/locale/context';
import type { ConsoleRpc } from '@/agent/rpc';
import type { DeviceCommandResult } from '@/agent/schema';

function SliderRow({
  label,
  currentValue,
  onApply,
}: {
  readonly label: string;
  readonly currentValue?: number;
  readonly onApply: (value: number) => Promise<DeviceCommandResult>;
}) {
  const deviceMessages = useMessages(DEVICE_MESSAGE_CATALOG);
  const [pendingValue, setPendingValue] = useState<number | null>(null);
  const [commandFailure, setCommandFailure] = useState<{
    readonly serverMessage: string | null;
  } | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Telemetry is the source of truth: once a fresh reading arrives, the
  // optimistic value has done its job and must stop shadowing the device.
  useEffect(() => {
    if (currentValue !== undefined) {
      setPendingValue(null);
    }
  }, [currentValue]);

  const displayedValue = pendingValue ?? currentValue;

  async function handleCommit(committedValue: number) {
    setIsApplying(true);
    setCommandFailure(null);
    try {
      const commandResult = await onApply(committedValue);
      if (!commandResult.ok) {
        setPendingValue(null);
        setCommandFailure({ serverMessage: commandResult.summary });
      }
    } catch (error) {
      setPendingValue(null);
      setCommandFailure({
        serverMessage: error instanceof Error ? error.message : null,
      });
    } finally {
      setIsApplying(false);
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="text-xs text-dim">{displayedValue ?? '—'}</span>
      </div>
      <Slider
        value={[displayedValue ?? 50]}
        min={0}
        max={100}
        step={1}
        disabled={isApplying}
        onValueChange={([nextValue]) => setPendingValue(nextValue)}
        onValueCommit={([committedValue]) => void handleCommit(committedValue)}
        aria-label={label}
      />
      {commandFailure !== null && (
        <p role="alert" className="text-xs text-destructive">
          {commandFailure.serverMessage ?? deviceMessages.commandFailedFallbackError}
        </p>
      )}
    </div>
  );
}

export function DeviceControls({
  consoleRpc,
  isDeviceConnected,
  currentVolume,
  isLoading,
  onApplied,
}: {
  readonly consoleRpc: ConsoleRpc;
  readonly isDeviceConnected: boolean;
  readonly currentVolume?: number;
  readonly isLoading?: boolean;
  readonly onApplied?: () => void;
}) {
  const deviceMessages = useMessages(DEVICE_MESSAGE_CATALOG);
  if (isLoading) {
    return (
      <div className="space-y-5 p-4">
        {['volume', 'brightness'].map((rowKey) => (
          <div key={rowKey} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-6" />
            </div>
            <Skeleton className="h-3.5 w-full" />
          </div>
        ))}
      </div>
    );
  }
  if (!isDeviceConnected) {
    return <p className="p-4 text-xs text-dim">{deviceMessages.offlineControlsNote}</p>;
  }
  return (
    <div className="space-y-5 p-4">
      <SliderRow
        label={deviceMessages.volumeLabel}
        currentValue={currentVolume}
        onApply={async (volume) => {
          const commandResult = await consoleRpc.setDeviceVolume(volume);
          if (commandResult.ok) {
            onApplied?.();
          }
          return commandResult;
        }}
      />
      <SliderRow
        label={deviceMessages.brightnessLabel}
        onApply={async (brightness) => {
          const commandResult = await consoleRpc.setDeviceBrightness(brightness);
          if (commandResult.ok) {
            onApplied?.();
          }
          return commandResult;
        }}
      />
    </div>
  );
}
