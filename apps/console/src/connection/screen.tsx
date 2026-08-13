import { useState } from 'react';
import type { FormEvent } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useConnection } from '@/connection/context';
import { probeWorkerHealth } from '@/connection/probe';
import { consoleConnectionSchema } from '@/connection/schema';
import { useDocumentMetadata } from '@/router/metadata';

const PROBE_ERROR_MESSAGE_MAP = {
  unreachable: 'Worker unreachable — check the URL and that the worker is deployed.',
  'not-apollo': 'That URL responds, but not like an Apollo worker — check /health.',
} as const;

export function ConnectScreen() {
  useDocumentMetadata(null);
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
      <div className="settle w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex">
            <Icons.LogoMark size={26} />
          </span>
          <h1 className="mt-4 font-serif text-[32px] leading-tight">Apollo Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The instrument panel for your desk agent
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border bg-card" aria-busy={isProbing}>
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm text-muted-foreground">Connect to your worker</h2>
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
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="device-name">Device name</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                spellCheck={false}
              />
              <p className="text-xs text-dim">
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
                className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {errorMessage}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isProbing}>
              {isProbing ? 'Probing worker…' : 'Connect'}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-dim">
          Stored in this browser only. Nothing leaves it except calls to your worker.
        </p>
      </div>
    </main>
  );
}
