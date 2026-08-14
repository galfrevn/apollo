import { describe, expect, it } from 'bun:test';

import {
  DOCS_CHAPTER_LIST_MAP,
  DOCS_CHAPTER_SLUG_LIST,
  DOCS_PART_LIST_MAP,
  findDocsChapterBySlug,
  formatDocsChapterNumber,
  isDocsChapterSlug,
} from '@/docs/catalog';
import { SUPPORTED_LOCALE_LIST } from '@/locale/detect';

describe('docs catalog', () => {
  it('keeps every chapter slug unique and single-word lowercase', () => {
    expect(new Set(DOCS_CHAPTER_SLUG_LIST).size).toBe(DOCS_CHAPTER_SLUG_LIST.length);
    for (const slug of DOCS_CHAPTER_SLUG_LIST) {
      expect(slug).toMatch(/^[a-z]+$/);
    }
  });

  it('numbers chapters contiguously in reading order for every locale', () => {
    for (const locale of SUPPORTED_LOCALE_LIST) {
      DOCS_CHAPTER_LIST_MAP[locale].forEach((chapterEntry, chapterIndex) => {
        expect(chapterEntry.number).toBe(chapterIndex + 1);
        expect(chapterEntry.slug).toBe(DOCS_CHAPTER_SLUG_LIST[chapterIndex]);
      });
    }
  });

  it('assigns every chapter to a declared part in every locale', () => {
    for (const locale of SUPPORTED_LOCALE_LIST) {
      const partTitleList = DOCS_PART_LIST_MAP[locale].map(
        (partEntry) => partEntry.title,
      );
      for (const chapterEntry of DOCS_CHAPTER_LIST_MAP[locale]) {
        expect(partTitleList).toContain(chapterEntry.partTitle);
      }
    }
  });

  it('translates every chapter title, description, and part title', () => {
    DOCS_CHAPTER_LIST_MAP.es.forEach((spanishEntry, chapterIndex) => {
      const englishEntry = DOCS_CHAPTER_LIST_MAP.en[chapterIndex];
      expect(englishEntry).toBeDefined();
      expect(spanishEntry.description).not.toBe(englishEntry?.description);
      expect(spanishEntry.title.trim().length).toBeGreaterThan(0);
      expect(spanishEntry.partTitle).not.toBe(englishEntry?.partTitle);
    });
  });

  it('ships a content file per locale for every chapter', async () => {
    for (const locale of SUPPORTED_LOCALE_LIST) {
      for (const slug of DOCS_CHAPTER_SLUG_LIST) {
        const contentFileUrl = new URL(
          `../content/${locale}/${slug}.md`,
          import.meta.url,
        );
        const contentText = await Bun.file(contentFileUrl).text();
        expect(contentText.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves chapters by slug per locale and rejects unknown slugs', () => {
    expect(findDocsChapterBySlug('loop', 'en')?.title).toBe('Loop');
    expect(findDocsChapterBySlug('loop', 'es')?.title).toBe('Ciclo');
    expect(findDocsChapterBySlug('nonsense', 'en')).toBeNull();
    expect(isDocsChapterSlug('protocol')).toBe(true);
    expect(isDocsChapterSlug('nonsense')).toBe(false);
  });

  it('formats chapter numbers with two digits', () => {
    expect(formatDocsChapterNumber(3)).toBe('03');
    expect(formatDocsChapterNumber(12)).toBe('12');
  });
});
