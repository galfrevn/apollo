import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnection } from '@/connection/context';
import { probeWorkerHealth } from '@/connection/probe';
import { consoleConnectionSchema } from '@/connection/schema';

const PROBE_ERROR_MESSAGE_MAP = {
  unreachable: 'Worker unreachable — check the URL and that the worker is deployed.',
  'not-apollo': 'That URL responds, but not like an Apollo worker — check /health.',
} as const;

export function ConnectScreen() {
  const { connect } = useConnection();
  const [workerUrl, setWorkerUrl] = useState('');
  const [deviceName, setDeviceName] = useState('desk');
  const [secret, setSecret] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    const parsedConnection = consoleConnectionSchema.safeParse({
      workerUrl,
      deviceName,
      secret,
    });
    if (!parsedConnection.success) {
      setErrorMessage(
        'Enter a full worker URL (https://…), a device name, and the dashboard secret.',
      );
      return;
    }
    setIsProbing(true);
    const probeResult = await probeWorkerHealth(parsedConnection.data.workerUrl);
    setIsProbing(false);
    if (probeResult.outcome !== 'ok') {
      setErrorMessage(PROBE_ERROR_MESSAGE_MAP[probeResult.outcome]);
      return;
    }
    connect(parsedConnection.data);
  }

  return (
    <main className="grid min-h-dvh place-items-center px-4 py-16">
      <div className="settle w-full max-w-md">
        <div className="mb-8 flex items-center gap-3">
          <span aria-hidden className="grid grid-cols-2 gap-0.5">
            <span className="size-2 bg-amber" />
            <span className="size-2 bg-amber/40" />
            <span className="size-2 bg-amber/40" />
            <span className="size-2 bg-amber/15" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-[-0.01em]">Apollo Console</h1>
            <p className="mt-0.5 text-sm text-muted">
              The instrument panel for your desk agent
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-line bg-panel"
          aria-busy={isProbing}
        >
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-medium">Connect to your worker</h2>
          </div>

          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <Label htmlFor="worker-url">Worker URL</Label>
              <Input
                id="worker-url"
                type="url"
                placeholder="https://apollo.example.workers.dev"
                value={workerUrl}
                onChange={(event) => setWorkerUrl(event.target.value)}
                autoComplete="url"
                spellCheck={false}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                spellCheck={false}
                className="font-mono"
              />
              <p className="text-xs text-faint">
                The agent instance the device connects as — “desk” unless changed in
                firmware.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-secret">Dashboard secret</Label>
              <Input
                id="dashboard-secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {errorMessage !== null && (
              <p
                role="alert"
                className="rounded-lg border border-danger/40 bg-dangerdim px-3 py-2 text-xs text-danger"
              >
                {errorMessage}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isProbing}>
              {isProbing ? 'Probing worker…' : 'Connect'}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-faint">
          Stored in this browser only. Nothing leaves it except calls to your worker.
        </p>
      </div>
    </main>
  );
}
