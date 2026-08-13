import { useEffect } from 'react';

export const LANDING_DOCUMENT_TITLE = 'Apollo | Your personal desk agent';
export const LANDING_DOCUMENT_DESCRIPTION =
  'The open-source brain for physical agentic devices: voice, memory, schedules, and tools, running in your own Cloudflare account.';

export const LANDING_LINK_MAP = {
  github: 'https://github.com/galfrevn/apollo',
  documentation: 'https://github.com/galfrevn/apollo/tree/main/documentation',
  console: '/console',
};

export function useLandingMetadata(): void {
  useEffect(() => {
    document.title = LANDING_DOCUMENT_TITLE;
    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute('content', LANDING_DOCUMENT_DESCRIPTION);
  }, []);
}
