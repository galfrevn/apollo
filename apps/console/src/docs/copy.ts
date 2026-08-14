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
  readonly copyCodeLabel: string;
  readonly copiedCodeLabel: string;
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
    searchPlaceholder: 'Buscar en el manual…',
    searchNoMatchesLabel: 'Nada en el manual coincide.',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Consola →',
    contentsTitle: 'Contenido',
    contentsTagline: 'El manual de Apollo, pensado para leerse en orden.',
    previousChapterLabel: 'Capítulo anterior',
    nextChapterLabel: 'Capítulo siguiente',
    copyCodeLabel: 'Copiar el código',
    copiedCodeLabel: 'Copiado',
    buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
      `Capítulo ${chapterNumber} de ${chapterTotal}`,
  },
  en: {
    brandSectionLabel: 'handbook',
    navigationAriaLabel: 'Handbook chapters',
    searchTriggerLabel: 'Search the handbook',
    searchPlaceholder: 'Search the handbook…',
    searchNoMatchesLabel: 'Nothing in the handbook matches.',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Console →',
    contentsTitle: 'Contents',
    contentsTagline: 'The Apollo handbook, meant to be read in order.',
    previousChapterLabel: 'Previous chapter',
    nextChapterLabel: 'Next chapter',
    copyCodeLabel: 'Copy code',
    copiedCodeLabel: 'Copied',
    buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
      `Chapter ${chapterNumber} of ${chapterTotal}`,
  },
};
