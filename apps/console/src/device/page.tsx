import { Suspense, lazy, useCallback, useEffect, useState } from 'react';

import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Button } from '@/components/ui/button';
import { DeviceControls } from '@/device/controls';
import { DEVICE_MESSAGE_CATALOG } from '@/device/copy';
import { WeatherPanel } from '@/device/weather';
import { useMessages } from '@/locale/context';
import type { ApolloAgentHandle } from '@/agent/hook';
import type { ConsoleRpc } from '@/agent/rpc';
import type { ConsoleStatus } from '@/agent/schema';

const STATUS_POLL_INTERVAL_MS = 10_000;

const SPEECH_MODE_LIST = ['default', 'nerd', 'playful', 'warm'] as const;

const DeviceModel = lazy(() =>
  import('@/device/model').then((module) => ({ default: module.DeviceModel })),
);

export function DevicePage({
  agent,
  consoleRpc,
}: {
  readonly agent: ApolloAgentHandle;
  readonly consoleRpc: ConsoleRpc;
}) {
  const deviceMessages = useMessages(DEVICE_MESSAGE_CATALOG);
  const [status, setStatus] = useState<ConsoleStatus | null>(null);
  const [isSettingMode, setIsSettingMode] = useState(false);
  const [modeErrorMessage, setModeErrorMessage] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setStatus(await consoleRpc.getStatus());
    } catch {
      // The page stays useful without a status snapshot; controls just wait.
    }
  }, [consoleRpc]);

  useEffect(() => {
    void refreshStatus();
    const intervalId = setInterval(() => void refreshStatus(), STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [refreshStatus]);

  async function handleSelectSpeechMode(speechModeId: string) {
    setIsSettingMode(true);
    setModeErrorMessage(null);
    try {
      await consoleRpc.setSpeechMode(speechModeId);
    } catch (error) {
      setModeErrorMessage(
        error instanceof Error ? error.message : deviceMessages.modeChangeFallbackError,
      );
    } finally {
      setIsSettingMode(false);
    }
  }

  const activeSpeechModeId = agent.state?.speechMode;
  const isDeviceConnected = status?.isDeviceConnected ?? false;

  return (
    <div className="settle space-y-6">
      <Heading description={deviceMessages.pageDescription}>
        {deviceMessages.pageTitle}
      </Heading>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-h-[28rem] items-center justify-center">
          <Suspense fallback={<div aria-hidden className="h-[26rem]" />}>
            <DeviceModel speechModeId={activeSpeechModeId} />
          </Suspense>
        </div>

        <div className="space-y-3 lg:self-center">
          <Panel title={deviceMessages.modePanelTitle}>
            <div className="flex flex-wrap gap-2 p-4">
              {SPEECH_MODE_LIST.map((speechModeId) => (
                <Button
                  key={speechModeId}
                  variant={speechModeId === activeSpeechModeId ? 'default' : 'outline'}
                  size="sm"
                  disabled={isSettingMode}
                  onClick={() => void handleSelectSpeechMode(speechModeId)}
                >
                  {speechModeId}
                </Button>
              ))}
            </div>
            <p className="px-4 pb-4 text-xs text-dim">{deviceMessages.modeHint}</p>
            {modeErrorMessage !== null && (
              <p role="alert" className="px-4 pb-4 text-xs text-destructive">
                {modeErrorMessage}
              </p>
            )}
          </Panel>

          <Panel title={deviceMessages.controlsPanelTitle}>
            <DeviceControls
              consoleRpc={consoleRpc}
              isDeviceConnected={isDeviceConnected}
              currentVolume={status?.telemetry?.volume}
              isLoading={status === null}
              onApplied={() => void refreshStatus()}
            />
          </Panel>

          <Panel title={deviceMessages.weatherPanelTitle}>
            <WeatherPanel consoleRpc={consoleRpc} />
          </Panel>
        </div>
      </div>
    </div>
  );
}
