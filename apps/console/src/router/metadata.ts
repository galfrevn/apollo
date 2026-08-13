import { useEffect } from 'react';

import type { ConsoleRoute } from '@/router/route';

export const ROUTE_LABEL_MAP = {
  status: 'Status',
  device: 'Device',
  mcp: 'MCP',
  memory: 'Memory',
  schedules: 'Schedules',
  history: 'History',
  jobs: 'Jobs',
} satisfies Record<ConsoleRoute, string>;

export const ROUTE_DESCRIPTION_MAP = {
  status: 'Live agent status, device connectivity, and telemetry at a glance.',
  device:
    'The desk device in 3D, with mode, volume, brightness, and weather location controls.',
  mcp: 'Installed MCP servers, their connection state, and per-tool enablement.',
  memory: 'What the agent remembers — memories, owner facts, and lists.',
  schedules: 'Scheduled reminders and running timers.',
  history: 'Past conversations between the owner and the desk.',
  jobs: 'Documents produced by research and coding runs.',
} satisfies Record<ConsoleRoute, string>;

const BASE_DOCUMENT_TITLE = 'Apollo | Console';
const BASE_DOCUMENT_DESCRIPTION =
  'The management console for Apollo, a personal desk agent.';

export function useDocumentMetadata(activeRoute: ConsoleRoute | null): void {
  useEffect(() => {
    document.title =
      activeRoute === null
        ? BASE_DOCUMENT_TITLE
        : `${BASE_DOCUMENT_TITLE} | ${ROUTE_LABEL_MAP[activeRoute]}`;

    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute(
      'content',
      activeRoute === null
        ? BASE_DOCUMENT_DESCRIPTION
        : ROUTE_DESCRIPTION_MAP[activeRoute],
    );
  }, [activeRoute]);
}
