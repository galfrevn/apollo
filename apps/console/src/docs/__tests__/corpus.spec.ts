import { describe, expect, it } from 'bun:test';

import { DOCS_CHAPTER_SLUG_LIST } from '@/docs/catalog';
import { buildDocsSearchCorpus, foldSearchText, searchDocsSections } from '@/docs/corpus';
import { SUPPORTED_LOCALE_LIST } from '@/locale/detect';

const englishSectionList = buildDocsSearchCorpus('en');
const spanishSectionList = buildDocsSearchCorpus('es');

describe('foldSearchText', () => {
  it('lowercases and strips diacritics without changing length', () => {
    expect(foldSearchText('Propósito')).toBe('proposito');
    expect(foldSearchText('Hey, Apólo').length).toBe('Hey, Apólo'.length);
  });
});

describe('buildDocsSearchCorpus', () => {
  it('covers every chapter in every locale', () => {
    for (const locale of SUPPORTED_LOCALE_LIST) {
      const coveredSlugSet = new Set(
        buildDocsSearchCorpus(locale).map((section) => section.chapterEntry.slug),
      );
      for (const slug of DOCS_CHAPTER_SLUG_LIST) {
        expect(coveredSlugSet.has(slug)).toBe(true);
      }
    }
  });

  it('splits chapters into heading sections with clean text', () => {
    const protocolSectionList = englishSectionList.filter(
      (section) => section.chapterEntry.slug === 'protocol',
    );
    const headingTextList = protocolSectionList.map((section) => section.headingText);
    expect(headingTextList).toContain('Connection lifecycle');
    expect(headingTextList).toContain('Audio framing');
    for (const section of protocolSectionList) {
      expect(section.bodyText).not.toContain('](');
      expect(section.bodyText).not.toContain('**');
    }
  });

  it('indexes translated prose rather than the english source', () => {
    const spanishHeadingTextList = spanishSectionList
      .filter((section) => section.chapterEntry.slug === 'protocol')
      .map((section) => section.headingText);
    expect(spanishHeadingTextList).toContain('Ciclo de conexión');
    expect(spanishHeadingTextList).not.toContain('Connection lifecycle');
  });

  it('preserves underscores in wire identifiers', () => {
    const matchList = searchDocsSections(englishSectionList, 'tts_aborted', 3);
    expect(matchList.length).toBeGreaterThan(0);
    expect(matchList[0].snippet?.matchText).toBe('tts_aborted');
  });
});

describe('searchDocsSections', () => {
  it('finds body text and returns a snippet around the match', () => {
    const matchList = searchDocsSections(englishSectionList, 'timing-safe', 5);
    expect(matchList.length).toBeGreaterThan(0);
    const [firstMatch] = matchList;
    expect(firstMatch.section.chapterEntry.slug).toBe('protocol');
    expect(firstMatch.snippet).not.toBeNull();
    expect(foldSearchText(firstMatch.snippet?.matchText ?? '')).toBe('timing-safe');
  });

  it('matches headings regardless of accents and case', () => {
    const matchList = searchDocsSections(spanishSectionList, 'CICLO DE CONEXION', 5);
    expect(matchList.some((match) => match.isHeadingMatch)).toBe(true);
  });

  it('respects the result limit', () => {
    expect(searchDocsSections(englishSectionList, 'the', 3).length).toBeLessThanOrEqual(
      3,
    );
  });

  it('returns nothing for a blank query', () => {
    expect(searchDocsSections(englishSectionList, '   ', 5)).toHaveLength(0);
  });
});
