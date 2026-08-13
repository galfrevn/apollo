import { DOCS_DOCUMENT_DESCRIPTION_MAP, DOCS_DOCUMENT_TITLE_MAP } from '@/docs/metadata';
import { buildChapterPath } from '@/docs/route';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_PUBLIC_ORIGIN } from '@/landing/origin';
import {
  LANDING_OPEN_GRAPH_LOCALE_MAP,
  LANDING_SOCIAL_DESCRIPTION_MAP,
  replaceExactlyOnce,
  stripLandingStaticBlock,
} from '@/landing/static';

import type { DocsChapterEntry } from '@/docs/catalog';

export function buildDocsDocument(
  templateHtml: string,
  chapterEntry: DocsChapterEntry | null,
): string {
  const landingTitle = LANDING_MESSAGE_CATALOG.es.metadata.documentTitle;
  const landingDescription = LANDING_MESSAGE_CATALOG.es.metadata.documentDescription;
  const docsTitle =
    chapterEntry === null
      ? DOCS_DOCUMENT_TITLE_MAP.en
      : `${DOCS_DOCUMENT_TITLE_MAP.en} | ${chapterEntry.title}`;
  const docsDescription =
    chapterEntry === null ? DOCS_DOCUMENT_DESCRIPTION_MAP.en : chapterEntry.description;
  const docsPageUrl = `${LANDING_PUBLIC_ORIGIN}${buildChapterPath(chapterEntry?.slug ?? null)}`;

  let docsDocument = stripLandingStaticBlock(templateHtml);
  docsDocument = replaceExactlyOnce(docsDocument, '<html lang="es">', '<html lang="en">');
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<title>${landingTitle}</title>`,
    `<title>${docsTitle}</title>`,
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `content="${landingDescription}"`,
    `content="${docsDescription}"`,
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<link rel="canonical" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    `<link rel="canonical" href="${docsPageUrl}" />`,
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `property="og:url" content="${LANDING_PUBLIC_ORIGIN}/"`,
    `property="og:url" content="${docsPageUrl}"`,
  );
  docsDocument = docsDocument.replaceAll(
    `content="${landingTitle}"`,
    `content="${docsTitle}"`,
  );
  docsDocument = docsDocument.replaceAll(
    LANDING_SOCIAL_DESCRIPTION_MAP.es,
    docsDescription,
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<link rel="alternate" hreflang="es" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    '',
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<link rel="alternate" hreflang="en" href="${LANDING_PUBLIC_ORIGIN}/en" />`,
    '',
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<link rel="alternate" hreflang="x-default" href="${LANDING_PUBLIC_ORIGIN}/" />`,
    '',
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<meta property="og:locale:alternate" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.en}" />`,
    '',
  );
  docsDocument = replaceExactlyOnce(
    docsDocument,
    `<meta property="og:locale" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.es}" />`,
    `<meta property="og:locale" content="${LANDING_OPEN_GRAPH_LOCALE_MAP.en}" />`,
  );
  return docsDocument;
}
