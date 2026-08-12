import { useSyncExternalStore } from 'react';

export type ConsoleRoute = 'status' | 'mcp' | 'memory' | 'schedules' | 'history' | 'jobs';

export const CONSOLE_ROUTE_LIST: readonly ConsoleRoute[] = [
  'status',
  'mcp',
  'memory',
  'schedules',
  'history',
  'jobs',
];

export function parseRouteFromHash(hash: string): ConsoleRoute {
  const candidate = hash.replace(/^#\/?/, '');
  return CONSOLE_ROUTE_LIST.find((route) => route === candidate) ?? 'status';
}

function subscribeToHashChanges(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function useConsoleRoute(): ConsoleRoute {
  return useSyncExternalStore(subscribeToHashChanges, () =>
    parseRouteFromHash(window.location.hash),
  );
}

export function navigateToRoute(route: ConsoleRoute): void {
  window.location.hash = `/${route}`;
}
