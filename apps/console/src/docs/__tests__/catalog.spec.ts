import { describe, expect, it } from 'bun:test';

import {
  DOCS_CHAPTER_LIST,
  DOCS_PART_LIST,
  findDocsChapterBySlug,
  formatDocsChapterNumber,
} from '@/docs/catalog';

describe('docs catalog', () => {
  it('keeps every chapter slug unique and single-word lowercase', () => {
    const slugList = DOCS_CHAPTER_LIST.map((chapterEntry) => chapterEntry.slug);
    expect(new Set(slugList).size).toBe(slugList.length);
    for (const slug of slugList) {
      expect(slug).toMatch(/^[a-z]+$/);
    }
  });

  it('numbers chapters contiguously in reading order', () => {
    DOCS_CHAPTER_LIST.forEach((chapterEntry, chapterIndex) => {
      expect(chapterEntry.number).toBe(chapterIndex + 1);
    });
  });

  it('assigns every chapter to a declared part', () => {
    const partTitleList = DOCS_PART_LIST.map((part) => part.title);
    for (const chapterEntry of DOCS_CHAPTER_LIST) {
      expect(partTitleList).toContain(chapterEntry.partTitle);
    }
  });

  it('ships a content stub for every chapter', async () => {
    for (const chapterEntry of DOCS_CHAPTER_LIST) {
      const contentFileUrl = new URL(
        `../content/${chapterEntry.slug}.md`,
        import.meta.url,
      );
      const contentText = await Bun.file(contentFileUrl).text();
      expect(contentText.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves chapters by slug and rejects unknown slugs', () => {
    expect(findDocsChapterBySlug('loop')?.title).toBe('Loop');
    expect(findDocsChapterBySlug('nonsense')).toBeNull();
  });

  it('formats chapter numbers with two digits', () => {
    expect(formatDocsChapterNumber(3)).toBe('03');
    expect(formatDocsChapterNumber(12)).toBe('12');
  });
});
