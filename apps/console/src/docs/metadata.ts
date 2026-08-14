import { useEffect } from 'react';

import type { DocsChapterEntry } from '@/docs/catalog';

export const DOCS_DOCUMENT_TITLE = 'Apollo | Handbook';

export const DOCS_DOCUMENT_DESCRIPTION =
  'The Apollo handbook: how the agent works inside, from the voice turn to deployment.';

export function useDocsMetadata(activeChapter: DocsChapterEntry | null): void {
  useEffect(() => {
    const baseTitle = DOCS_DOCUMENT_TITLE;
    document.title =
      activeChapter === null ? baseTitle : `${baseTitle} | ${activeChapter.title}`;

    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute(
      'content',
      activeChapter === null ? DOCS_DOCUMENT_DESCRIPTION : activeChapter.description,
    );
  }, [activeChapter]);
}
