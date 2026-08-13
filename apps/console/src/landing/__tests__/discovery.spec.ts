import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_PUBLIC_ORIGIN, LANDING_REPOSITORY_URL } from '@/landing/origin';
import {
  LANDING_SOCIAL_DESCRIPTION_MAP,
  LANDING_STATIC_CLOSE_MARKER,
  LANDING_STATIC_OPEN_MARKER,
  buildConsoleDocument,
  buildLandingDocument,
  renderLandingStaticBlock,
} from '@/landing/static';

const applicationRootUrl = new URL('../../../', import.meta.url);

async function readApplicationFile(relativePath: string): Promise<string> {
  return Bun.file(new URL(relativePath, applicationRootUrl)).text();
}

const structuredDataSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@graph': z
    .array(
      z.object({
        '@type': z.enum(['WebSite', 'SoftwareApplication', 'Person']),
        '@id': z.string().startsWith(LANDING_PUBLIC_ORIGIN),
        name: z.string().min(1),
        url: z.string().min(1),
        description: z.string().optional(),
        sameAs: z.array(z.string().startsWith(LANDING_REPOSITORY_URL)).optional(),
        featureList: z.string().optional(),
        license: z.string().startsWith(LANDING_REPOSITORY_URL).optional(),
      }),
    )
    .length(3),
});

describe('landing discovery template', () => {
  it('carries the complete crawler-facing head', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const spanishMetadata = LANDING_MESSAGE_CATALOG.es.metadata;
    expect(templateHtml).toContain('<html lang="es">');
    expect(templateHtml).toContain(`<title>${spanishMetadata.documentTitle}</title>`);
    expect(templateHtml).toContain(spanishMetadata.documentDescription);
    expect(templateHtml).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    );
    expect(templateHtml).toContain(`hreflang="es"`);
    expect(templateHtml).toContain(`hreflang="en"`);
    expect(templateHtml).toContain(`hreflang="x-default"`);
    expect(templateHtml).toContain('property="og:site_name"');
    expect(templateHtml).toContain('property="og:image:alt"');
    expect(templateHtml).toContain('name="twitter:title"');
    expect(templateHtml).toContain('name="twitter:description"');
    expect(templateHtml).toContain('name="twitter:image"');
    expect(templateHtml).toContain('name="theme-color"');
    expect(templateHtml).toContain('rel="manifest"');
    expect(templateHtml).toContain(LANDING_SOCIAL_DESCRIPTION_MAP.es);
    expect(templateHtml).toContain(LANDING_STATIC_OPEN_MARKER);
    expect(templateHtml).toContain(LANDING_STATIC_CLOSE_MARKER);
    expect(templateHtml).not.toContain('THESIS:');
  });

  it('declares valid structured data matching the spanish catalog', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const structuredDataMatch = templateHtml.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(structuredDataMatch).not.toBeNull();
    if (structuredDataMatch === null) {
      return;
    }
    const rawStructuredData: unknown = JSON.parse(structuredDataMatch[1] ?? '');
    const structuredData = structuredDataSchema.parse(rawStructuredData);
    const softwareEntry = structuredData['@graph'].find(
      (graphEntry) => graphEntry['@type'] === 'SoftwareApplication',
    );
    expect(softwareEntry?.description).toBe(
      LANDING_MESSAGE_CATALOG.es.metadata.documentDescription,
    );
    const spanishFeatureList = LANDING_MESSAGE_CATALOG.es.capabilities.capabilityRowList
      .map((capabilityRow) => capabilityRow.name)
      .join(', ');
    expect(softwareEntry?.featureList).toBe(spanishFeatureList);
  });
});

describe('landing document generation', () => {
  it('renders every crawler-relevant copy string per locale', () => {
    for (const locale of ['es', 'en'] as const) {
      const staticBlock = renderLandingStaticBlock(locale);
      const landingMessages = LANDING_MESSAGE_CATALOG[locale];
      expect(staticBlock).toContain('<h1 ');
      expect(staticBlock).toContain('font-serif');
      expect(staticBlock).toContain(landingMessages.hero.subhead);
      expect(staticBlock).toContain(landingMessages.showcase.actTitle);
      expect(staticBlock).toContain(landingMessages.architecture.actTitle);
      expect(staticBlock).toContain(landingMessages.capabilities.actTitle);
      expect(staticBlock).toContain(landingMessages.yours.actTitle);
      for (const capabilityRow of landingMessages.capabilities.capabilityRowList) {
        expect(staticBlock).toContain(`${capabilityRow.name}</h3>`);
        expect(staticBlock).toContain(capabilityRow.description);
      }
      for (const ownershipCard of landingMessages.yours.ownershipCardList) {
        expect(staticBlock).toContain(`${ownershipCard.label}</h3>`);
      }
      expect(staticBlock).toContain('<h3 class=');
      expect(staticBlock).toContain(LANDING_REPOSITORY_URL);
    }
  });

  it('builds the localized english document from the spanish template', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const englishDocument = buildLandingDocument(templateHtml, 'en');
    const englishMetadata = LANDING_MESSAGE_CATALOG.en.metadata;
    expect(englishDocument).toContain('<html lang="en">');
    expect(englishDocument).toContain(`<title>${englishMetadata.documentTitle}</title>`);
    expect(englishDocument).toContain(englishMetadata.documentDescription);
    expect(englishDocument).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/en" />`,
    );
    expect(englishDocument).toContain(LANDING_SOCIAL_DESCRIPTION_MAP.en);
    expect(englishDocument).toContain(LANDING_MESSAGE_CATALOG.en.hero.subhead);
  });

  it('builds a noindexed console shell without landing copy', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const consoleDocument = buildConsoleDocument(templateHtml);
    expect(consoleDocument).toContain('<meta name="robots" content="noindex" />');
    expect(consoleDocument).not.toContain(LANDING_STATIC_OPEN_MARKER);
    expect(consoleDocument).not.toContain('<h1');
  });
});

describe('crawl control files', () => {
  it('serves a robots policy that welcomes ai crawlers and hides the console', async () => {
    const robotsPolicy = await readApplicationFile('public/robots.txt');
    expect(robotsPolicy).toContain('Disallow: /console');
    expect(robotsPolicy).toContain(`Sitemap: ${LANDING_PUBLIC_ORIGIN}/sitemap.xml`);
    for (const crawlerName of [
      'GPTBot',
      'ClaudeBot',
      'PerplexityBot',
      'Google-Extended',
    ]) {
      expect(robotsPolicy).toContain(`User-agent: ${crawlerName}\nAllow: /`);
    }
  });

  it('lists both locale urls with reciprocal hreflang in the sitemap', async () => {
    const sitemapDocument = await readApplicationFile('public/sitemap.xml');
    expect(sitemapDocument).toContain(`<loc>${LANDING_PUBLIC_ORIGIN}/</loc>`);
    expect(sitemapDocument).toContain(`<loc>${LANDING_PUBLIC_ORIGIN}/en</loc>`);
    expect(sitemapDocument.match(/hreflang="x-default"/g)).toHaveLength(2);
  });

  it('describes apollo for language models in both languages', async () => {
    const llmsDocument = await readApplicationFile('public/llms.txt');
    expect(llmsDocument).toContain('# Apollo');
    expect(llmsDocument).toContain('## English');
    expect(llmsDocument).toContain(LANDING_REPOSITORY_URL);
    expect(llmsDocument).toContain(`${LANDING_PUBLIC_ORIGIN}/en`);
    expect(llmsDocument).not.toContain('—');
  });

  it('ships a parseable manifest and a branded not-found page', async () => {
    const manifestSchema = z.object({
      name: z.literal('Apollo'),
      theme_color: z.literal('#0d0d0d'),
      icons: z.array(z.object({ src: z.string(), type: z.string() })).min(2),
    });
    const rawManifest: unknown = JSON.parse(
      await readApplicationFile('public/site.webmanifest'),
    );
    expect(() => manifestSchema.parse(rawManifest)).not.toThrow();
    const notFoundDocument = await readApplicationFile('public/404.html');
    expect(notFoundDocument).toContain('name="robots" content="noindex"');
    expect(notFoundDocument).toContain('href="/"');
  });
});
