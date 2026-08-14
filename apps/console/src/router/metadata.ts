import { useEffect } from 'react';

import type { ConsoleRoute } from '@/router/route';

export const ROUTE_LABEL_MAP: Record<ConsoleRoute, string> = {
  status: 'Status',
  device: 'Device',
  broadcast: 'Broadcast',
  mcp: 'MCP',
  memory: 'Memory',
  schedules: 'Schedules',
  history: 'History',
  jobs: 'Jobs',
};

export const ROUTE_DESCRIPTION_MAP: Record<ConsoleRoute, string> = {
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
};

const BASE_DOCUMENT_TITLE = 'Apollo | Console';

const BASE_DOCUMENT_DESCRIPTION =
  'The management console for Apollo, a personal agent with a body.';

export function useDocumentMetadata(activeRoute: ConsoleRoute | null): void {
  useEffect(() => {
    const baseTitle = BASE_DOCUMENT_TITLE;
    document.title =
      activeRoute === null ? baseTitle : `${baseTitle} | ${ROUTE_LABEL_MAP[activeRoute]}`;

    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute(
      'content',
      activeRoute === null
        ? BASE_DOCUMENT_DESCRIPTION
        : ROUTE_DESCRIPTION_MAP[activeRoute],
    );
  }, [activeRoute]);
}
