import { useState } from 'react';
import type { FormEvent } from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CONNECTION_MESSAGE_CATALOG } from '@/connection/copy';
import { useConnection } from '@/connection/context';
import { probeWorkerHealth } from '@/connection/probe';
import { consoleConnectionSchema } from '@/connection/schema';
import { useMessages } from '@/locale/context';
import { LocaleToggle } from '@/locale/toggle';
import { useDocumentMetadata } from '@/router/metadata';

type ConnectFailureKind = 'validation' | 'unreachable' | 'not-apollo';

export function ConnectScreen() {
  useDocumentMetadata(null);
  const { connect } = useConnection();
  const connectionMessages = useMessages(CONNECTION_MESSAGE_CATALOG);
  const [workerUrl, setWorkerUrl] = useState('');
  const [deviceName, setDeviceName] = useState('desk');
  const [secret, setSecret] = useState('');
  const [failureKind, setFailureKind] = useState<ConnectFailureKind | null>(null);
  const [isProbing, setIsProbing] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFailureKind(null);
    const parsedConnection = consoleConnectionSchema.safeParse({
      workerUrl,
      deviceName,
      secret,
    });
    if (!parsedConnection.success) {
      setFailureKind('validation');
      return;
    }
    setIsProbing(true);
    const probeResult = await probeWorkerHealth(parsedConnection.data.workerUrl);
    setIsProbing(false);
    if (probeResult.outcome !== 'ok') {
      setFailureKind(probeResult.outcome);
      return;
    }
    connect(parsedConnection.data);
  }

  const failureMessage =
    failureKind === null
      ? null
      : failureKind === 'validation'
        ? connectionMessages.validationMessage
        : connectionMessages.probeErrorMap[failureKind];

  return (
    <main className="relative grid min-h-dvh place-items-center px-4 py-16">
      <LocaleToggle className="absolute top-6 right-6" />
      <div className="settle w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="inline-flex">
            <Icons.LogoMark size={26} />
          </span>
          <h1 className="mt-4 font-serif text-[32px] leading-tight">Apollo Console</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {connectionMessages.tagline}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="border bg-card" aria-busy={isProbing}>
          <div className="border-b px-5 py-3.5">
            <h2 className="text-sm text-muted-foreground">
              {connectionMessages.formTitle}
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <div className="space-y-2">
              <Label htmlFor="worker-url">{connectionMessages.workerUrlLabel}</Label>
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
              <Label htmlFor="device-name">{connectionMessages.deviceNameLabel}</Label>
              <Input
                id="device-name"
                value={deviceName}
                onChange={(event) => setDeviceName(event.target.value)}
                spellCheck={false}
              />
              <p className="text-xs text-dim">{connectionMessages.deviceNameHint}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-secret">
                {connectionMessages.dashboardSecretLabel}
              </Label>
              <Input
                id="dashboard-secret"
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                autoComplete="current-password"
              />
            </div>

            {failureMessage !== null && (
              <p
                role="alert"
                className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {failureMessage}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isProbing}>
              {isProbing
                ? connectionMessages.probingLabel
                : connectionMessages.connectLabel}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-dim">
          {connectionMessages.privacyNote}
        </p>
      </div>
    </main>
  );
}
