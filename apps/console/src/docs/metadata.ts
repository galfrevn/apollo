import { useEffect } from 'react';

import { useLocale } from '@/locale/context';

import type { DocsChapterEntry } from '@/docs/catalog';
import type { Locale } from '@/locale/detect';

export const DOCS_DOCUMENT_TITLE_MAP: Record<Locale, string> = {
  es: 'Apollo | Manual',
  en: 'Apollo | Handbook',
};

export const DOCS_DOCUMENT_DESCRIPTION_MAP: Record<Locale, string> = {
  es: 'El manual de Apollo: cómo funciona el agente de escritorio, del turno de voz al despliegue.',
  en: 'The Apollo handbook: how the desk agent works, from the voice turn to deployment.',
};

export function useDocsMetadata(activeChapter: DocsChapterEntry | null): void {
  const { locale } = useLocale();

  useEffect(() => {
    const baseTitle = DOCS_DOCUMENT_TITLE_MAP[locale];
    document.title =
      activeChapter === null ? baseTitle : `${baseTitle} | ${activeChapter.title}`;

    const descriptionElement = document.querySelector('meta[name="description"]');
    descriptionElement?.setAttribute(
      'content',
      activeChapter === null
        ? DOCS_DOCUMENT_DESCRIPTION_MAP[locale]
        : activeChapter.description,
    );
  }, [activeChapter, locale]);
}
