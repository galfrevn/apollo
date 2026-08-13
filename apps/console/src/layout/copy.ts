import type { Locale } from '@/locale/detect';

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

export const LAYOUT_MESSAGE_CATALOG: Record<Locale, LayoutMessages> = {
  es: {
    navigationAriaLabel: 'Secciones de la consola',
    searchTriggerLabel: 'Buscar secciones',
    searchPlaceholder: 'Buscar secciones…',
    searchNoMatches: 'Nada coincide',
    connectionConnectedLabel: 'Conectado',
    connectionUnauthorizedLabel: 'No autorizado',
    connectionConnectingLabel: 'Conectando…',
    disconnectLabel: 'Desconectar',
    unauthorizedBanner:
      'El worker rechazó esta conexión — la clave del panel probablemente es incorrecta. Desconéctate y escríbela de nuevo.',
  },
  en: {
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
  },
};
