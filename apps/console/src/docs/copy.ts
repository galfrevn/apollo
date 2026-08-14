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

// "Handbook" is the product's own name for this surface, so it stays English in
// every locale — the same way "Apollo" and "worker" do.
export const DOCS_MESSAGE_CATALOG: Record<Locale, DocsMessages> = {
  es: {
    brandSectionLabel: 'handbook',
    navigationAriaLabel: 'Capítulos del handbook',
    searchTriggerLabel: 'Buscar en el handbook',
    searchPlaceholder: 'Buscar en el handbook…',
    searchNoMatchesLabel: 'Nada coincide en el handbook.',
    githubLabel: 'GitHub',
    openConsoleLabel: 'Consola →',
    contentsTitle: 'Contenido',
    contentsTagline: 'Todo lo que hace Apollo, en el orden en que conviene leerlo.',
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
    contentsTagline: 'Everything Apollo does, in the order it makes sense to read it.',
    previousChapterLabel: 'Previous chapter',
    nextChapterLabel: 'Next chapter',
    copyCodeLabel: 'Copy code',
    copiedCodeLabel: 'Copied',
    buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
      `Chapter ${chapterNumber} of ${chapterTotal}`,
  },
};
