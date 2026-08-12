import { useEffect, useState } from 'react';

import { Chip } from '@/blueprint/chip';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { cn } from '@/components/utility';
import { TelemetryGrid } from '@/status/telemetry';
import type { ApolloAgentHandle } from '@/agent/hook';
import type { ApolloAgentState, ConsoleStatus } from '@/agent/schema';
import type { ConsoleRpc } from '@/agent/rpc';
import type { ChipTone } from '@/blueprint/chip';

const STATUS_POLL_INTERVAL_MS = 10_000;

const UI_STATE_TONE_MAP: Record<ApolloAgentState['uiState'], ChipTone> = {
  idle: 'idle',
  listening: 'live',
  thinking: 'busy',
  confirm: 'busy',
  speaking: 'live',
  focus: 'busy',
  dashboard: 'idle',
};

export function StatusPage({
  agent,
  consoleRpc,
}: {
  readonly agent: ApolloAgentHandle;
  readonly consoleRpc: ConsoleRpc;
}) {
  const [status, setStatus] = useState<ConsoleStatus | null>(null);
  const [didPollFail, setDidPollFail] = useState(false);

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
  const isDeviceConnected = status?.isDeviceConnected ?? false;

  return (
    <div className="settle space-y-5">
      <Heading description="Live picture of the desk and its agent">Status</Heading>

      <div className="grid gap-4 xl:grid-cols-[minmax(16rem,1fr)_2fr]">
        <Panel title="Device link">
          <div
            className={cn(
              'flex min-h-40 flex-col items-center justify-center gap-3 p-6 transition-colors duration-300',
              !isDeviceConnected && 'pixelfield',
            )}
          >
            <span aria-hidden className="grid grid-cols-2 gap-0.5">
              <span
                className={cn(
                  'size-2 transition-colors duration-300',
                  isDeviceConnected ? 'bg-amber' : 'bg-line',
                )}
              />
              <span
                className={cn(
                  'size-2 transition-colors duration-300',
                  isDeviceConnected ? 'bg-amber/60' : 'bg-line',
                )}
              />
              <span
                className={cn(
                  'size-2 transition-colors duration-300',
                  isDeviceConnected ? 'bg-amber/60' : 'bg-line',
                )}
              />
              <span
                className={cn(
                  'size-2 transition-colors duration-300',
                  isDeviceConnected ? 'bg-amber/25' : 'bg-line',
                )}
              />
            </span>
            <p className="label-soft text-muted">
              {status === null
                ? 'Checking…'
                : isDeviceConnected
                  ? 'Desk online'
                  : 'Desk offline'}
            </p>
            {status !== null && status.deviceConnectionCount > 1 && (
              <p className="text-xs text-faint">
                {status.deviceConnectionCount} device connections
              </p>
            )}
          </div>
        </Panel>

        <Panel
          title="Agent"
          meta={
            agentState !== undefined ? (
              <Chip tone={UI_STATE_TONE_MAP[agentState.uiState]}>
                {agentState.uiState}
              </Chip>
            ) : undefined
          }
        >
          {agentState === undefined ? (
            <p className="p-4 text-sm text-muted">Waiting for state sync…</p>
          ) : (
            <dl className="grid grid-cols-2 gap-px bg-line sm:grid-cols-3">
              <div className="bg-panel p-4">
                <dt className="label-soft text-faint">Speech mode</dt>
                <dd className="mt-1.5 text-sm">{agentState.speechMode}</dd>
              </div>
              <div className="bg-panel p-4">
                <dt className="label-soft text-faint">Focus</dt>
                <dd className="mt-1.5 text-sm">
                  {agentState.focusEndsAt === null
                    ? 'Off'
                    : `Until ${new Date(agentState.focusEndsAt).toLocaleTimeString()}`}
                </dd>
              </div>
              <div className="bg-panel p-4">
                <dt className="label-soft text-faint">Reminders</dt>
                <dd className="mt-1.5 text-sm">
                  {status === null ? '—' : status.pendingReminderCount}
                </dd>
              </div>
              <div aria-hidden className="bg-panel sm:hidden" />
              {agentState.caption !== null && (
                <div className="col-span-full bg-panel p-4">
                  <dt className="label-soft text-faint">Caption</dt>
                  <dd className="mt-1.5 text-sm text-muted">{agentState.caption}</dd>
                </div>
              )}
              {agentState.pendingConfirmSummary !== null && (
                <div className="col-span-full bg-panel p-4">
                  <dt className="label-soft text-amber">Awaiting confirmation</dt>
                  <dd className="mt-1.5 text-sm">{agentState.pendingConfirmSummary}</dd>
                </div>
              )}
            </dl>
          )}
        </Panel>
      </div>

      <Panel title="Telemetry">
        <div className="p-4">
          <TelemetryGrid
            telemetry={status?.telemetry ?? null}
            nowMilliseconds={status?.nowMilliseconds ?? Date.now()}
          />
          {didPollFail && (
            <p role="alert" className="mt-3 text-xs text-danger">
              Status poll failed — retrying every {STATUS_POLL_INTERVAL_MS / 1000}s.
            </p>
          )}
        </div>
      </Panel>
    </div>
  );
}
