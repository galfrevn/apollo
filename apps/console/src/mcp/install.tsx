import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { McpInstallResult } from '@/agent/schema';

export function InstallForm({
  onInstall,
}: {
  readonly onInstall: (name: string, url: string) => Promise<McpInstallResult>;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setAuthUrl(null);
    if (name.trim().length === 0 || !url.startsWith('https://')) {
      setErrorMessage('Give the server a name and an https:// URL.');
      return;
    }
    setIsInstalling(true);
    try {
      const installResult = await onInstall(name.trim(), url.trim());
      setName('');
      setUrl('');
      if (installResult.authUrl !== null) {
        setAuthUrl(installResult.authUrl);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Install failed — check the URL.',
      );
    } finally {
      setIsInstalling(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4" aria-busy={isInstalling}>
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="mcp-name">Name</Label>
          <Input
            id="mcp-name"
            placeholder="linear"
            value={name}
            onChange={(event) => setName(event.target.value)}
            spellCheck={false}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mcp-url">Server URL</Label>
          <Input
            id="mcp-url"
            type="url"
            placeholder="https://mcp.example.com/sse"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            spellCheck={false}
          />
        </div>
        <Button type="submit" disabled={isInstalling}>
          {isInstalling ? 'Installing…' : 'Install'}
        </Button>
      </div>

      {errorMessage !== null && (
        <p role="alert" className="text-xs text-danger">
          {errorMessage}
        </p>
      )}
      {authUrl !== null && (
        <p className="rounded-lg border border-amber/40 bg-amberdim px-3 py-2 text-xs text-amber">
          This server needs authorization —{' '}
          <a
            href={authUrl}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2"
          >
            open the auth page
          </a>
          , then refresh the list.
        </p>
      )}
    </form>
  );
}
