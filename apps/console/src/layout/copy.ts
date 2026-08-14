interface LayoutMessages {
  readonly navigationAriaLabel: string;
  readonly searchTriggerLabel: string;
  readonly searchPlaceholder: string;
  readonly searchNoMatches: string;
  readonly connectionConnectedLabel: string;
  readonly connectionUnauthorizedLabel: string;
  readonly connectionConnectingLabel: string;
  readonly disconnectLabel: string;
  readonly unauthorizedBanner: string;
}

export const LAYOUT_MESSAGES: LayoutMessages = {
  navigationAriaLabel: 'Console sections',
  searchTriggerLabel: 'Search sections',
  searchPlaceholder: 'Search sections…',
  searchNoMatches: 'Nothing matches',
  connectionConnectedLabel: 'Connected',
  connectionUnauthorizedLabel: 'Unauthorized',
  connectionConnectingLabel: 'Connecting…',
  disconnectLabel: 'Disconnect',
  unauthorizedBanner:
    'The worker refused this connection — the dashboard secret is likely wrong. Disconnect and enter it again.',
};
