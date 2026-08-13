import { CONSOLE_ROUTE_LIST } from '@/router/hash';

export const CONSOLE_BASE_PATH = '/console';

export type SurfaceResolution =
  | { readonly kind: 'landing' }
  | { readonly kind: 'console' }
  | { readonly kind: 'redirect'; readonly targetUrl: string };

export function resolveSurfaceFromLocation(
  pathname: string,
  hash: string,
): SurfaceResolution {
  if (pathname === CONSOLE_BASE_PATH || pathname.startsWith(`${CONSOLE_BASE_PATH}/`)) {
    return { kind: 'console' };
  }
  if (pathname === '/' && isKnownConsoleRouteHash(hash)) {
    return { kind: 'redirect', targetUrl: `${CONSOLE_BASE_PATH}${hash}` };
  }
  return { kind: 'landing' };
}

function isKnownConsoleRouteHash(hash: string): boolean {
  if (!hash.startsWith('#')) {
    return false;
  }
  const candidate = hash.replace(/^#\/?/, '');
  return CONSOLE_ROUTE_LIST.some((route) => route === candidate);
}
