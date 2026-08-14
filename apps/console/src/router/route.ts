import { useSyncExternalStore } from 'react';

import { runNavigationWithViewTransition } from '@/components/transition';

export type ConsoleRoute =
  | 'status'
  | 'device'
  | 'broadcast'
  | 'mcp'
  | 'memory'
  | 'schedules'
  | 'history'
  | 'jobs';

export const CONSOLE_ROUTE_LIST: readonly ConsoleRoute[] = [
  'status',
  'device',
  'broadcast',
  'mcp',
  'memory',
  'schedules',
  'history',
  'jobs',
];

export const CONSOLE_BASE_PATH = '/console';

const NAVIGATION_EVENT_NAME = 'console:navigation';

export function parseRouteFromPathname(pathname: string): ConsoleRoute {
  const candidate = pathname.startsWith(CONSOLE_BASE_PATH)
    ? pathname.slice(CONSOLE_BASE_PATH.length).replace(/^\/+/, '').replace(/\/+$/, '')
    : '';
  return CONSOLE_ROUTE_LIST.find((route) => route === candidate) ?? 'status';
}

function subscribeToNavigation(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATION_EVENT_NAME, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATION_EVENT_NAME, onChange);
  };
}

export function useConsoleRoute(): ConsoleRoute {
  return useSyncExternalStore(subscribeToNavigation, () =>
    parseRouteFromPathname(window.location.pathname),
  );
}

export function navigateToRoute(route: ConsoleRoute): void {
  runNavigationWithViewTransition(() => {
    window.history.pushState(null, '', `${CONSOLE_BASE_PATH}/${route}`);
    window.dispatchEvent(new Event(NAVIGATION_EVENT_NAME));
  });
}
