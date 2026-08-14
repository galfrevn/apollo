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
  readonly roadmapProgressLabel: string;
  readonly roadmapProgressCaption: string;
  readonly roadmapIntro: string;
  readonly roadmapClosing: string;
  readonly buildChapterPositionLabel: (
    chapterNumber: number,
    chapterTotal: number,
  ) => string;
}

export const DOCS_MESSAGES: DocsMessages = {
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
  roadmapProgressLabel: 'Roughly built',
  roadmapProgressCaption:
    'Everything in the rest of this handbook is the first tenth. The nine chapters before this one describe what already works; this one describes what it is for.',
  roadmapIntro:
    'Apollo works today, and what works is a narrow slice of the idea: one provider, one reference body, one way to change its character. The tracks below are the rest, roughly in the order they matter. Nothing here has a date, and anything with a status of exploring may turn out to be a bad idea.',
  roadmapClosing:
    'If one of these matters more to you than the others, that is worth saying out loud in an issue: the order is a guess, and a guess is easy to change. For the granular open work, with file paths and current status, the repository carries an engineering roadmap next to the source.',
  buildChapterPositionLabel: (chapterNumber, chapterTotal) =>
    `Chapter ${chapterNumber} of ${chapterTotal}`,
};
