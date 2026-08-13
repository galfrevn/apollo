import { useEffect } from 'react';

import { useLocale } from '@/locale/context';
import type { Locale } from '@/locale/detect';
import type { ConsoleRoute } from '@/router/route';

export const ROUTE_LABEL_CATALOG: Record<Locale, Record<ConsoleRoute, string>> = {
  es: {
    status: 'Estado',
    device: 'Dispositivo',
    broadcast: 'Difusión',
    mcp: 'MCP',
    memory: 'Memoria',
    schedules: 'Agenda',
    history: 'Historial',
    jobs: 'Trabajos',
  },
  en: {
    status: 'Status',
    device: 'Device',
    broadcast: 'Broadcast',
    mcp: 'MCP',
    memory: 'Memory',
    schedules: 'Schedules',
    history: 'History',
    jobs: 'Jobs',
  },
};

export const ROUTE_DESCRIPTION_CATALOG: Record<Locale, Record<ConsoleRoute, string>> = {
  es: {
    status:
      'Estado del agente en vivo, conectividad del dispositivo y telemetría de un vistazo.',
    device:
      'El dispositivo de escritorio en 3D, con controles de modo, volumen, brillo y ubicación del clima.',
    broadcast:
      'Habla al escritorio al instante — escribe una frase o graba tu voz y suena en el dispositivo.',
    mcp: 'Servidores MCP instalados, su estado de conexión y habilitación por herramienta.',
    memory: 'Lo que el agente recuerda — memorias, datos del dueño y listas.',
    schedules: 'Recordatorios programados y temporizadores en curso.',
    history: 'Conversaciones pasadas entre el dueño y el escritorio.',
    jobs: 'Documentos producidos por sesiones de investigación y programación.',
  },
  en: {
    status: 'Live agent status, device connectivity, and telemetry at a glance.',
    device:
      'The desk device in 3D, with mode, volume, brightness, and weather location controls.',
    broadcast:
      'Speak to the desk instantly — type a phrase or record your voice and it plays on the device.',
    mcp: 'Installed MCP servers, their connection state, and per-tool enablement.',
    memory: 'What the agent remembers — memories, owner facts, and lists.',
    schedules: 'Scheduled reminders and running timers.',
    history: 'Past conversations between the owner and the desk.',
    jobs: 'Documents produced by research and coding runs.',
  },
};

const BASE_DOCUMENT_TITLE_MAP: Record<Locale, string> = {
  es: 'Apollo | Consola',
  en: 'Apollo | Console',
};

const BASE_DOCUMENT_DESCRIPTION_MAP: Record<Locale, string> = {
  es: 'La consola de administración de Apollo, un agente personal de escritorio.',
  en: 'The management console for Apollo, a personal desk agent.',
};

export function useDocumentMetadata(activeRoute: ConsoleRoute | null): void {
  const { locale } = useLocale();

  useEffect(() => {
    const baseTitle = BASE_DOCUMENT_TITLE_MAP[locale];
    document.title =
      activeRoute === null
        ? baseTitle
        : `${baseTitle} | ${ROUTE_LABEL_CATALOG[locale][activeRoute]}`;

    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute(
      'content',
      activeRoute === null
        ? BASE_DOCUMENT_DESCRIPTION_MAP[locale]
        : ROUTE_DESCRIPTION_CATALOG[locale][activeRoute],
    );
  }, [activeRoute, locale]);
}
