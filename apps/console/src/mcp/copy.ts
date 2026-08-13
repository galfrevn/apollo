import type { Locale } from '@/locale/detect';

interface McpMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly refreshLabel: string;
  readonly installServerLabel: string;
  readonly listServersFallbackError: string;
  readonly installRetryFallbackError: string;
  readonly noServersMessage: string;
  readonly toolsOnLabel: (enabledCount: number, totalCount: number) => string;
  readonly needsAuthorizationSuffix: string;
  readonly installDialogTitle: string;
  readonly connectorsPanelTitle: string;
  readonly connectorsPanelMeta: string;
  readonly signInHintLabel: string;
  readonly tokenHintLabel: string;
  readonly installedLabel: string;
  readonly addingLabel: string;
  readonly installLabel: string;
  readonly serverStateLabelMap: Readonly<Record<string, string>>;
  readonly awaitingAuthorizationPrefix: string;
  readonly authorizationLinkLabel: string;
  readonly awaitingAuthorizationSuffix: string;
  readonly toolsEnabledLabel: (enabledCount: number, totalCount: number) => string;
  readonly noToolsMessage: string;
  readonly toggleToolAriaLabel: (isEnabled: boolean, toolName: string) => string;
  readonly safeBadgeLabel: string;
  readonly asksFirstBadgeLabel: string;
  readonly retryingLabel: string;
  readonly retryLabel: string;
  readonly uninstallingLabel: string;
  readonly uninstallLabel: string;
  readonly nameFieldLabel: string;
  readonly urlFieldLabel: string;
  readonly tokenFieldLabel: string;
  readonly installValidationError: string;
  readonly installUrlFallbackError: string;
  readonly tokenFieldHint: string;
  readonly authorizationNoticePrefix: string;
  readonly authorizationNoticeSuffix: string;
  readonly installingLabel: string;
}

export const MCP_MESSAGE_CATALOG: Record<Locale, McpMessages> = {
  es: {
    pageTitle: 'MCP',
    pageDescription: 'Servidores y herramientas que el agente puede usar',
    refreshLabel: 'Actualizar',
    installServerLabel: 'Instalar servidor',
    listServersFallbackError: 'No se pudieron listar los servidores MCP.',
    installRetryFallbackError: 'Falló la instalación — intenta de nuevo.',
    noServersMessage: 'No hay servidores MCP instalados',
    toolsOnLabel: (enabledCount, totalCount) =>
      `${enabledCount}/${totalCount} herramientas activas`,
    needsAuthorizationSuffix: ' · requiere autorización',
    installDialogTitle: 'Instalar un servidor',
    connectorsPanelTitle: 'Conectores',
    connectorsPanelMeta: 'Instalación en un clic',
    signInHintLabel: 'Iniciar sesión',
    tokenHintLabel: 'Token',
    installedLabel: 'Instalado',
    addingLabel: 'Agregando…',
    installLabel: 'Instalar',
    serverStateLabelMap: {
      ready: 'listo',
      connecting: 'conectando',
      authenticating: 'autenticando',
      discovering: 'descubriendo',
      failed: 'falló',
    },
    awaitingAuthorizationPrefix: 'Esperando autorización — ',
    authorizationLinkLabel: 'abre la página de autorización',
    awaitingAuthorizationSuffix: ', luego actualiza.',
    toolsEnabledLabel: (enabledCount, totalCount) =>
      `${enabledCount}/${totalCount} herramientas habilitadas`,
    noToolsMessage: 'Aún no se descubrieron herramientas',
    toggleToolAriaLabel: (isEnabled, toolName) =>
      `${isEnabled ? 'Deshabilitar' : 'Habilitar'} ${toolName}`,
    safeBadgeLabel: 'Segura',
    asksFirstBadgeLabel: 'Pregunta primero',
    retryingLabel: 'Conectando…',
    retryLabel: 'Reintentar conexión',
    uninstallingLabel: 'Quitando…',
    uninstallLabel: 'Desinstalar servidor',
    nameFieldLabel: 'Nombre',
    urlFieldLabel: 'URL del servidor',
    tokenFieldLabel: 'Token de acceso',
    installValidationError: 'Ponle un nombre al servidor y una URL https://.',
    installUrlFallbackError: 'Falló la instalación — revisa la URL.',
    tokenFieldHint:
      'Opcional — solo para servidores que usan un token de acceso personal en lugar de OAuth. Los servidores con inicio de sesión (Linear, Notion) muestran un enlace de autorización tras la instalación.',
    authorizationNoticePrefix: 'Este servidor necesita autorización — ',
    authorizationNoticeSuffix: ', luego actualiza la lista.',
    installingLabel: 'Instalando…',
  },
  en: {
    pageTitle: 'MCP',
    pageDescription: 'Servers and tools the agent may use',
    refreshLabel: 'Refresh',
    installServerLabel: 'Install server',
    listServersFallbackError: 'Could not list MCP servers.',
    installRetryFallbackError: 'Install failed — try again.',
    noServersMessage: 'No MCP servers installed',
    toolsOnLabel: (enabledCount, totalCount) => `${enabledCount}/${totalCount} tools on`,
    needsAuthorizationSuffix: ' · needs authorization',
    installDialogTitle: 'Install a server',
    connectorsPanelTitle: 'Connectors',
    connectorsPanelMeta: 'One-click installs',
    signInHintLabel: 'Sign in',
    tokenHintLabel: 'Token',
    installedLabel: 'Installed',
    addingLabel: 'Adding…',
    installLabel: 'Install',
    serverStateLabelMap: {
      ready: 'ready',
      connecting: 'connecting',
      authenticating: 'authenticating',
      discovering: 'discovering',
      failed: 'failed',
    },
    awaitingAuthorizationPrefix: 'Awaiting authorization — ',
    authorizationLinkLabel: 'open the auth page',
    awaitingAuthorizationSuffix: ', then refresh.',
    toolsEnabledLabel: (enabledCount, totalCount) =>
      `${enabledCount}/${totalCount} tools enabled`,
    noToolsMessage: 'No tools discovered yet',
    toggleToolAriaLabel: (isEnabled, toolName) =>
      `${isEnabled ? 'Disable' : 'Enable'} ${toolName}`,
    safeBadgeLabel: 'Safe',
    asksFirstBadgeLabel: 'Asks first',
    retryingLabel: 'Connecting…',
    retryLabel: 'Retry connection',
    uninstallingLabel: 'Removing…',
    uninstallLabel: 'Uninstall server',
    nameFieldLabel: 'Name',
    urlFieldLabel: 'Server URL',
    tokenFieldLabel: 'Access token',
    installValidationError: 'Give the server a name and an https:// URL.',
    installUrlFallbackError: 'Install failed — check the URL.',
    tokenFieldHint:
      'Optional — only for servers that use a personal access token instead of OAuth. Sign-in servers (Linear, Notion) show an authorization link after install.',
    authorizationNoticePrefix: 'This server needs authorization — ',
    authorizationNoticeSuffix: ', then refresh the list.',
    installingLabel: 'Installing…',
  },
};

export function resolveServerStateLabel(
  serverState: string,
  mcpMessages: McpMessages,
): string {
  return mcpMessages.serverStateLabelMap[serverState] ?? serverState;
}
