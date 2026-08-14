import { DOCS_CHAPTER_LIST_MAP } from '@/docs/catalog';
import { DOCS_SOURCE_MAP } from '@/docs/source';

import type { DocsChapterEntry } from '@/docs/catalog';
import type { Locale } from '@/locale/detect';

export interface DocsSearchSection {
  readonly chapterEntry: DocsChapterEntry;
  readonly headingText: string | null;
  readonly bodyText: string;
  readonly foldedHeadingText: string | null;
  readonly foldedBodyText: string;
}

export interface DocsSearchSnippet {
  readonly beforeText: string;
  readonly matchText: string;
  readonly afterText: string;
}

export interface DocsSearchMatch {
  readonly section: DocsSearchSection;
  readonly isHeadingMatch: boolean;
  readonly snippet: DocsSearchSnippet | null;
}

const SNIPPET_CONTEXT_LENGTH = 44;

// Character-by-character folding keeps the folded text the same length as the
// original, so a match index in folded space is valid in the original string.
export function foldSearchText(rawText: string): string {
  let foldedText = '';
  for (const character of Array.from(rawText)) {
    const baseCharacter = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    foldedText += (baseCharacter.charAt(0) || ' ').toLowerCase();
    for (let extraIndex = 1; extraIndex < character.length; extraIndex++) {
      foldedText += ' ';
    }
  }
  return foldedText;
}

function stripMarkdownDecorations(line: string): string {
  return line
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*]/g, '')
    .replace(/^>\s?/, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildChapterSectionList(
  chapterEntry: DocsChapterEntry,
  markdownSource: string,
): readonly DocsSearchSection[] {
  const sectionList: DocsSearchSection[] = [];
  let currentHeadingText: string | null = null;
  let currentLineList: string[] = [];
  const flushSection = () => {
    const bodyText = currentLineList.join(' ').replace(/\s+/g, ' ').trim();
    if (bodyText !== '' || currentHeadingText !== null) {
      sectionList.push({
        chapterEntry,
        headingText: currentHeadingText,
        bodyText,
        foldedHeadingText:
          currentHeadingText === null ? null : foldSearchText(currentHeadingText),
        foldedBodyText: foldSearchText(bodyText),
      });
    }
    currentLineList = [];
  };
  for (const rawLine of markdownSource.split('\n')) {
    const headingMatch = /^#{2,3}\s+(.*)$/.exec(rawLine);
    if (headingMatch !== null) {
      flushSection();
      currentHeadingText = stripMarkdownDecorations(headingMatch[1]);
      continue;
    }
    if (rawLine.startsWith('```') || /^\s*\|?\s*-{3,}/.test(rawLine)) {
      continue;
    }
    const strippedLine = stripMarkdownDecorations(rawLine);
    if (strippedLine !== '') {
      currentLineList.push(strippedLine);
    }
  }
  flushSection();
  return sectionList;
}

export function buildDocsSearchCorpus(locale: Locale): readonly DocsSearchSection[] {
  return DOCS_CHAPTER_LIST_MAP[locale].flatMap((chapterEntry) =>
    buildChapterSectionList(
      chapterEntry,
      DOCS_SOURCE_MAP[locale][chapterEntry.slug] ?? '',
    ),
  );
}

function buildSnippet(
  bodyText: string,
  matchIndex: number,
  matchLength: number,
): DocsSearchSnippet {
  const beforeStart = Math.max(0, matchIndex - SNIPPET_CONTEXT_LENGTH);
  const afterEnd = Math.min(
    bodyText.length,
    matchIndex + matchLength + SNIPPET_CONTEXT_LENGTH,
  );
  let beforeText = bodyText.slice(beforeStart, matchIndex);
  if (beforeStart > 0) {
    beforeText = `…${beforeText.replace(/^\S*\s/, '')}`;
  }
  let afterText = bodyText.slice(matchIndex + matchLength, afterEnd);
  if (afterEnd < bodyText.length) {
    afterText = `${afterText.replace(/\s\S*$/, '')}…`;
  }
  return {
    beforeText,
    matchText: bodyText.slice(matchIndex, matchIndex + matchLength),
    afterText,
  };
}

export function searchDocsSections(
  sectionList: readonly DocsSearchSection[],
  rawQuery: string,
  resultLimit: number,
): readonly DocsSearchMatch[] {
  const foldedQuery = foldSearchText(rawQuery.trim()).replace(/\s+/g, ' ');
  if (foldedQuery === '') {
    return [];
  }
  const matchList: DocsSearchMatch[] = [];
  for (const section of sectionList) {
    if (matchList.length >= resultLimit) {
      break;
    }
    const isHeadingMatch =
      section.foldedHeadingText !== null &&
      section.foldedHeadingText.includes(foldedQuery);
    const bodyMatchIndex = section.foldedBodyText.indexOf(foldedQuery);
    if (!isHeadingMatch && bodyMatchIndex === -1) {
      continue;
    }
    matchList.push({
      section,
      isHeadingMatch,
      snippet:
        bodyMatchIndex === -1
          ? null
          : buildSnippet(section.bodyText, bodyMatchIndex, foldedQuery.length),
    });
  }
  return matchList;
}
