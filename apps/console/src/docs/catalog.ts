export interface DocsChapter {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
}

export interface DocsPart {
  readonly title: string;
  readonly chapterList: readonly DocsChapter[];
}

export interface DocsChapterEntry extends DocsChapter {
  readonly number: number;
  readonly partTitle: string;
}

export const DOCS_PART_LIST: readonly DocsPart[] = [
  {
    title: 'Part I — Introduction',
    chapterList: [
      {
        slug: 'purpose',
        title: 'Purpose',
        description: 'What Apollo is and is not.',
      },
      {
        slug: 'concepts',
        title: 'Concepts',
        description: 'Desk, turns, sessions, and tools.',
      },
    ],
  },
  {
    title: 'Part II — Runtime',
    chapterList: [
      {
        slug: 'loop',
        title: 'Loop',
        description: 'How a request becomes a spoken reply.',
      },
      {
        slug: 'protocol',
        title: 'Protocol',
        description: 'The messages between the device and the server.',
      },
    ],
  },
  {
    title: 'Part III — Capabilities',
    chapterList: [
      {
        slug: 'capabilities',
        title: 'Capabilities',
        description: 'Every tool Apollo can reach, and when it asks first.',
      },
    ],
  },
  {
    title: 'Part IV — Operations',
    chapterList: [
      {
        slug: 'setup',
        title: 'Setup',
        description: 'From one command to a deployed, talking worker.',
      },
      {
        slug: 'console',
        title: 'Console',
        description: 'Manage a deployment from the browser.',
      },
      {
        slug: 'skills',
        title: 'Skills',
        description: 'Hand the manual to your coding agent.',
      },
    ],
  },
  {
    title: 'Part V — Body',
    chapterList: [
      {
        slug: 'firmware',
        title: 'Firmware',
        description: 'Build, flash, and point a body at your brain.',
      },
    ],
  },
  {
    title: 'Part VI — What is next',
    chapterList: [
      {
        slug: 'roadmap',
        title: 'Roadmap',
        description: 'Where Apollo is going, and how far along it is.',
      },
    ],
  },
];

function flattenDocsPartList(partList: readonly DocsPart[]): readonly DocsChapterEntry[] {
  const chapterEntryList: DocsChapterEntry[] = [];
  for (const part of partList) {
    for (const chapter of part.chapterList) {
      chapterEntryList.push({
        ...chapter,
        number: chapterEntryList.length + 1,
        partTitle: part.title,
      });
    }
  }
  return chapterEntryList;
}

export const DOCS_CHAPTER_LIST: readonly DocsChapterEntry[] =
  flattenDocsPartList(DOCS_PART_LIST);

export function findDocsChapterBySlug(slug: string): DocsChapterEntry | null {
  return DOCS_CHAPTER_LIST.find((chapterEntry) => chapterEntry.slug === slug) ?? null;
}

export function formatDocsChapterNumber(chapterNumber: number): string {
  return String(chapterNumber).padStart(2, '0');
}
