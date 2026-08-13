import type { Locale } from '@/locale/detect';

interface DocsMessages {
  readonly brandSectionLabel: string;
  readonly navigationAriaLabel: string;
  readonly searchTriggerLabel: string;
  readonly searchPlaceholder: string;
  readonly searchNoMatchesLabel: string;
  readonly githubLabel: string;
  readonly openConsoleLabel: string;
  readonly contentsTitle: string;
  readonly contentsTagline: string;
  readonly previousChapterLabel: string;
  readonly nextChapterLabel: string;
  readonly buildChapterPositionLabel: (
    chapterNumber: number,
    chapterTotal: number,
  ) => string;
}

export const DOCS_MESSAGE_CATALOG: Record<Locale, DocsMessages> = {
  es: {
    brandSectionLabel: 'manual',
    navigationAriaLabel: 'Capítulos del manual',
    searchTriggerLabel: 'Buscar en el manual',
    searchPlaceholder: 'Buscar un capítulo…',
    searchNoMatchesLabel: 'Ningún capítulo coincide.',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Consola →',
    contentsTitle: 'Contenido',
    contentsTagline: 'El manual de Apollo, pensado para leerse en orden.',
    previousChapterLabel: 'Capítulo anterior',
    nextChapterLabel: 'Capítulo siguiente',
    buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
      `Capítulo ${chapterNumber} de ${chapterTotal}`,
  },
  en: {
    brandSectionLabel: 'handbook',
    navigationAriaLabel: 'Handbook chapters',
    searchTriggerLabel: 'Search the handbook',
    searchPlaceholder: 'Search for a chapter…',
    searchNoMatchesLabel: 'No chapter matches.',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Console →',
    contentsTitle: 'Contents',
    contentsTagline: 'The Apollo handbook, meant to be read in order.',
    previousChapterLabel: 'Previous chapter',
    nextChapterLabel: 'Next chapter',
    buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
      `Chapter ${chapterNumber} of ${chapterTotal}`,
  },
};
