import { describe, expect, it } from 'bun:test';
import { z } from 'zod';

import { LANDING_MESSAGES } from '@/landing/copy/text';
import { LANDING_PUBLIC_ORIGIN, LANDING_REPOSITORY_URL } from '@/landing/origin';
import {
  LANDING_SOCIAL_DESCRIPTION,
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
    const landingMetadata = LANDING_MESSAGES.metadata;
    expect(templateHtml).toContain('<html lang="en">');
    expect(templateHtml).toContain(`<title>${landingMetadata.documentTitle}</title>`);
    expect(templateHtml).toContain(landingMetadata.documentDescription);
    expect(templateHtml).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    );
    expect(templateHtml).not.toContain('hreflang');
    expect(templateHtml).toContain('property="og:site_name"');
    expect(templateHtml).toContain('property="og:image:alt"');
    expect(templateHtml).toContain('name="twitter:title"');
    expect(templateHtml).toContain('name="twitter:description"');
    expect(templateHtml).toContain('name="twitter:image"');
    expect(templateHtml).toContain('name="theme-color"');
    expect(templateHtml).toContain('rel="manifest"');
    expect(templateHtml).toContain(LANDING_SOCIAL_DESCRIPTION);
    expect(templateHtml).toContain(LANDING_STATIC_OPEN_MARKER);
    expect(templateHtml).toContain(LANDING_STATIC_CLOSE_MARKER);
    expect(templateHtml).toContain("setAttribute('data-scripting', '')");
    expect(templateHtml).not.toContain('THESIS:');
  });

  it('declares valid structured data matching the copy', async () => {
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
      LANDING_MESSAGES.metadata.documentDescription,
    );
    const featureList = LANDING_MESSAGES.capabilities.capabilityRowList
      .map((capabilityRow) => capabilityRow.name)
      .join(', ');
    expect(softwareEntry?.featureList).toBe(featureList);
  });
});

describe('landing document generation', () => {
  it('renders every crawler-relevant copy string', () => {
    const staticBlock = renderLandingStaticBlock();
    const landingMessages = LANDING_MESSAGES;
    expect(staticBlock).toContain('<h1 ');
    expect(staticBlock).toContain('data-landing-static');
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
    expect(staticBlock).toContain(`${landingMessages.start.title}</h3>`);
    expect(staticBlock).toContain('$ bun create heyapollo');
    expect(staticBlock).toContain('$ npm create heyapollo');
    expect(staticBlock).toContain(landingMessages.start.terminalCaption);
    expect(staticBlock).toContain(landingMessages.start.agentPrompt);
    expect(staticBlock).toContain(landingMessages.start.agentCaption);
    expect(staticBlock).toContain('<h3 class=');
    expect(staticBlock).toContain(LANDING_REPOSITORY_URL);
  });

  it('injects the static block into the single landing document', async () => {
    const templateHtml = await readApplicationFile('index.html');
    const landingDocument = buildLandingDocument(templateHtml);
    expect(landingDocument).toContain('<html lang="en">');
    expect(landingDocument).toContain(
      `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    );
    expect(landingDocument).toContain(LANDING_SOCIAL_DESCRIPTION);
    expect(landingDocument).toContain(LANDING_MESSAGES.hero.subhead);
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

  it('lists a single landing url with no locale alternates', async () => {
    const sitemapDocument = await readApplicationFile('public/sitemap.xml');
    expect(sitemapDocument).toContain(`<loc>${LANDING_PUBLIC_ORIGIN}/</loc>`);
    expect(sitemapDocument).not.toContain('hreflang');
  });

  it('describes apollo for language models', async () => {
    const llmsDocument = await readApplicationFile('public/llms.txt');
    expect(llmsDocument).toContain('# Apollo');
    expect(llmsDocument).toContain(LANDING_REPOSITORY_URL);
    expect(llmsDocument).toContain(`${LANDING_PUBLIC_ORIGIN}/docs`);
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
