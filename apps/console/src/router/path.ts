import { CONSOLE_BASE_PATH, CONSOLE_ROUTE_LIST } from '@/router/route';

import type { Locale } from '@/locale/detect';
import type { ConsoleRoute } from '@/router/route';

export type SurfaceResolution =
  | { readonly kind: 'landing'; readonly localeOverride: Locale | null }
  | { readonly kind: 'console' }
  | { readonly kind: 'redirect'; readonly targetUrl: string };

export function resolveSurfaceFromLocation(
  pathname: string,
  hash: string,
): SurfaceResolution {
  const isConsolePath =
    pathname === CONSOLE_BASE_PATH || pathname.startsWith(`${CONSOLE_BASE_PATH}/`);
  const legacyHashRoute = parseLegacyHashRoute(hash);
  if (isConsolePath) {
    if (legacyHashRoute !== null) {
      return {
        kind: 'redirect',
        targetUrl: `${CONSOLE_BASE_PATH}/${legacyHashRoute}`,
      };
    }
    return { kind: 'console' };
  }
  if (pathname === '/' && legacyHashRoute !== null) {
    return {
      kind: 'redirect',
      targetUrl: `${CONSOLE_BASE_PATH}/${legacyHashRoute}`,
    };
  }
  if (pathname === '/en' || pathname === '/en/') {
    return { kind: 'landing', localeOverride: 'en' };
  }
  return { kind: 'landing', localeOverride: null };
}

function parseLegacyHashRoute(hash: string): ConsoleRoute | null {
  if (hash === '#' || hash === '#/') {
    return 'status';
  }
  if (!hash.startsWith('#')) {
    return null;
  }
  const candidate = hash.replace(/^#\/?/, '');
  return CONSOLE_ROUTE_LIST.find((route) => route === candidate) ?? null;
}
