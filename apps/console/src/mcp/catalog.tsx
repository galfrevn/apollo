import {
  siAtlassian,
  siCloudflare,
  siGithub,
  siLinear,
  siNotion,
  siSentry,
  siStripe,
  siVercel,
} from 'simple-icons';

import { Panel } from '@/blueprint/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export type ConnectorAuthKind = 'oauth' | 'token' | 'none';

export type ConnectorDefinition = {
  readonly name: string;
  readonly label: string;
  readonly url: string;
  readonly description: string;
  readonly auth: ConnectorAuthKind;
  readonly iconPath?: string;
};

export const CONNECTOR_LIST: readonly ConnectorDefinition[] = [
  {
    name: 'github',
    iconPath: siGithub.path,
    label: 'GitHub',
    url: 'https://api.githubcopilot.com/mcp/',
    description: 'Repos, issues, and pull requests',
    auth: 'token',
  },
  {
    name: 'linear',
    iconPath: siLinear.path,
    label: 'Linear',
    url: 'https://mcp.linear.app/mcp',
    description: 'Issues, projects, and cycles',
    auth: 'oauth',
  },
  {
    name: 'notion',
    iconPath: siNotion.path,
    label: 'Notion',
    url: 'https://mcp.notion.com/mcp',
    description: 'Pages and databases',
    auth: 'oauth',
  },
  {
    name: 'sentry',
    iconPath: siSentry.path,
    label: 'Sentry',
    url: 'https://mcp.sentry.dev/mcp',
    description: 'Errors and performance issues',
    auth: 'oauth',
  },
  {
    name: 'stripe',
    iconPath: siStripe.path,
    label: 'Stripe',
    url: 'https://mcp.stripe.com',
    description: 'Payments, customers, and invoices',
    auth: 'oauth',
  },
  {
    name: 'vercel',
    iconPath: siVercel.path,
    label: 'Vercel',
    url: 'https://mcp.vercel.com',
    description: 'Deployments and projects',
    auth: 'oauth',
  },
  {
    name: 'atlassian',
    iconPath: siAtlassian.path,
    label: 'Atlassian',
    url: 'https://mcp.atlassian.com/v1/sse',
    description: 'Jira issues and Confluence pages',
    auth: 'oauth',
  },
  {
    name: 'cloudflare-docs',
    iconPath: siCloudflare.path,
    label: 'Cloudflare Docs',
    url: 'https://docs.mcp.cloudflare.com/sse',
    description: 'Cloudflare documentation search',
    auth: 'none',
  },
  {
    name: 'deepwiki',
    label: 'DeepWiki',
    url: 'https://mcp.deepwiki.com/mcp',
    description: 'Ask questions about public GitHub repos',
    auth: 'none',
  },
  {
    name: 'context7',
    label: 'Context7',
    url: 'https://mcp.context7.com/mcp',
    description: 'Up-to-date library documentation',
    auth: 'none',
  },
];

const AUTH_HINT_LABEL_MAP = {
  oauth: 'Sign in',
  token: 'Token',
  none: null,
} satisfies Record<ConnectorAuthKind, string | null>;

export function ConnectorCatalog({
  installedUrlSet,
  busyConnectorUrl,
  onInstallConnector,
}: {
  readonly installedUrlSet: ReadonlySet<string>;
  readonly busyConnectorUrl: string | null;
  readonly onInstallConnector: (connector: ConnectorDefinition) => void;
}) {
  return (
    <Panel
      title="Connectors"
      meta={<span className="text-xs text-dim">One-click installs</span>}
    >
      <ul>
        {CONNECTOR_LIST.map((connector) => {
          const isInstalled = installedUrlSet.has(connector.url);
          const authHintLabel = AUTH_HINT_LABEL_MAP[connector.auth];
          return (
            <li
              key={connector.url}
              className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
            >
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center border bg-accent"
              >
                {connector.iconPath === undefined ? (
                  <span className="text-xs font-medium text-muted-foreground">
                    {connector.label.charAt(0)}
                  </span>
                ) : (
                  <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                    <path d={connector.iconPath} />
                  </svg>
                )}
              </span>
              <span className="w-28 shrink-0 truncate text-sm font-medium">
                {connector.label}
              </span>
              <span className="min-w-0 flex-1 truncate text-xs text-dim">
                {connector.description}
              </span>
              {authHintLabel !== null && <Badge variant="outline">{authHintLabel}</Badge>}
              {isInstalled ? (
                <span className="w-20 text-right text-xs text-dim">Installed</span>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-20"
                  disabled={busyConnectorUrl !== null}
                  onClick={() => onInstallConnector(connector)}
                >
                  {busyConnectorUrl === connector.url ? 'Adding…' : 'Install'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
