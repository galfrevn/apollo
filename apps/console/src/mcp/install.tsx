import { useState } from 'react';
import type { FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMessages } from '@/locale/context';
import { MCP_MESSAGE_CATALOG } from '@/mcp/copy';
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
  const mcpMessages = useMessages(MCP_MESSAGE_CATALOG);
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
      setErrorMessage(mcpMessages.installValidationError);
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
        error instanceof Error ? error.message : mcpMessages.installUrlFallbackError,
      );
    } finally {
      setIsInstalling(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isInstalling}>
      <div className="space-y-2">
        <Label htmlFor="mcp-name">{mcpMessages.nameFieldLabel}</Label>
        <Input
          id="mcp-name"
          placeholder="linear"
          value={name}
          onChange={(event) => setName(event.target.value)}
          spellCheck={false}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="mcp-url">{mcpMessages.urlFieldLabel}</Label>
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
        <Label htmlFor="mcp-token">{mcpMessages.tokenFieldLabel}</Label>
        <Input
          id="mcp-token"
          type="password"
          value={authToken}
          onChange={(event) => setAuthToken(event.target.value)}
          autoComplete="off"
        />
        <p className="text-xs text-dim">{mcpMessages.tokenFieldHint}</p>
      </div>

      {errorMessage !== null && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
      {authUrl !== null && (
        <p className="border bg-accent px-3 py-2 text-xs text-muted-foreground">
          {mcpMessages.authorizationNoticePrefix}
          <a
            href={authUrl}
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            {mcpMessages.authorizationLinkLabel}
          </a>
          {mcpMessages.authorizationNoticeSuffix}
        </p>
      )}

      <Button type="submit" className="w-full" disabled={isInstalling}>
        {isInstalling ? mcpMessages.installingLabel : mcpMessages.installLabel}
      </Button>
    </form>
  );
}
