import { useEffect } from 'react';

import { LANDING_MESSAGES } from '@/landing/copy/text';

export const LANDING_LINK_MAP = {
  github: 'https://github.com/galfrevn/apollo',
  documentation: '/docs',
  console: '/console',
};

export const LANDING_COMMAND_MAP = {
  bun: 'bun create heyapollo',
  npm: 'npm create heyapollo',
} as const;

export const LANDING_START_ANCHOR_ID = 'start';

export function useLandingMetadata(): void {
  useEffect(() => {
    const landingMetadata = LANDING_MESSAGES.metadata;
    document.title = landingMetadata.documentTitle;
    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute('content', landingMetadata.documentDescription);
  }, []);
}
