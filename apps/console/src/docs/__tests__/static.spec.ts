import { describe, expect, it } from 'bun:test';

import { DOCS_CHAPTER_LIST, findDocsChapterBySlug } from '@/docs/catalog';
import { DOCS_DOCUMENT_TITLE_MAP } from '@/docs/metadata';
import { buildDocsDocument } from '@/docs/static';
import { LANDING_PUBLIC_ORIGIN } from '@/landing/origin';
import { LANDING_STATIC_OPEN_MARKER } from '@/landing/static';

const applicationRootUrl = new URL('../../../', import.meta.url);

async function readApplicationFile(relativePath: string): Promise<string> {
  return Bun.file(new URL(relativePath, applicationRootUrl)).text();
}

describe('docs document generation', () => {
  it('builds an indexable english contents document without landing copy', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const docsDocument = buildDocsDocument(templateHtml, null);
    expect(docsDocument).toContain('<meta name="robots" content="index, follow" />');
    expect(docsDocument).not.toContain(LANDING_STATIC_OPEN_MARKER);
    expect(docsDocument).toContain('<html lang="en">');
    expect(docsDocument).toContain(`<title>${DOCS_DOCUMENT_TITLE_MAP.en}</title>`);
    expect(docsDocument).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/docs" />`,
    );
    expect(docsDocument).not.toContain('hreflang=');
  });

  it('builds a chapter document carrying that chapter metadata', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const loopChapter = findDocsChapterBySlug('loop');
    expect(loopChapter).not.toBeNull();
    if (loopChapter === null) {
      return;
    }
    const chapterDocument = buildDocsDocument(templateHtml, loopChapter);
    expect(chapterDocument).toContain(
      `<title>${DOCS_DOCUMENT_TITLE_MAP.en} | ${loopChapter.title}</title>`,
    );
    expect(chapterDocument).toContain(`content="${loopChapter.description}"`);
    expect(chapterDocument).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/docs/loop" />`,
    );
  });
});

describe('docs crawl control', () => {
  it('lists the docs root and every chapter in the sitemap', async () => {
    const sitemapDocument = await readApplicationFile('public/sitemap.xml');
    expect(sitemapDocument).toContain(`<loc>${LANDING_PUBLIC_ORIGIN}/docs</loc>`);
    for (const chapterEntry of DOCS_CHAPTER_LIST) {
      expect(sitemapDocument).toContain(
        `<loc>${LANDING_PUBLIC_ORIGIN}/docs/${chapterEntry.slug}</loc>`,
      );
    }
  });

  it('points language models at the hosted docs', async () => {
    const llmsDocument = await readApplicationFile('public/llms.txt');
    expect(llmsDocument).toContain(`${LANDING_PUBLIC_ORIGIN}/docs`);
    expect(llmsDocument).not.toContain(
      'github.com/galfrevn/apollo/tree/main/documentation',
    );
  });

  it('keeps the docs crawlable in the robots policy', async () => {
    const robotsPolicy = await readApplicationFile('public/robots.txt');
    expect(robotsPolicy).not.toContain('Disallow: /docs');
  });
});
