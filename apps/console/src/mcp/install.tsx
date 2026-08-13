import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { McpInstallResult } from '@/agent/schema';

export function InstallForm({
  onInstall,
  onInstalled,
  initialName,
  initialUrl,
}: {
  readonly onInstall: (
    name: string,
    url: string,
    authToken?: string,
  ) => Promise<McpInstallResult>;
  readonly onInstalled?: (installResult: McpInstallResult) => void;
  readonly initialName?: string;
  readonly initialUrl?: string;
}) {
  const [name, setName] = useState(initialName ?? '');
  const [url, setUrl] = useState(initialUrl ?? '');
  const [authToken, setAuthToken] = useState('');
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
      const trimmedAuthToken = authToken.trim();
      const installResult = await onInstall(
        name.trim(),
        url.trim(),
        trimmedAuthToken.length === 0 ? undefined : trimmedAuthToken,
      );
      setName('');
      setUrl('');
      setAuthToken('');
      if (installResult.authUrl !== null) {
        setAuthUrl(installResult.authUrl);
      }
      onInstalled?.(installResult);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Install failed — check the URL.',
      );
    } finally {
      setIsInstalling(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isInstalling}>
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
      <div className="space-y-2">
        <Label htmlFor="mcp-token">Access token</Label>
        <Input
          id="mcp-token"
          type="password"
          value={authToken}
          onChange={(event) => setAuthToken(event.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-dim">
          Optional — only for servers that use a personal access token instead of OAuth.
          Sign-in servers (Linear, Notion) show an authorization link after install.
        </p>
      </div>

      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
      {authUrl !== null && (
        <p className="border bg-accent px-3 py-2 text-xs text-muted-foreground">
          This server needs authorization —{' '}
          <a
            href={authUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            open the auth page
          </a>
          , then refresh the list.
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isInstalling}>
        {isInstalling ? 'Installing…' : 'Install'}
      </Button>
    </form>
  );
}
