import { DOCS_DOCUMENT_DESCRIPTION_MAP, DOCS_DOCUMENT_TITLE_MAP } from '@/docs/metadata';
import { buildChapterPath } from '@/docs/route';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_PUBLIC_ORIGIN } from '@/landing/origin';
import {
  LANDING_OPEN_GRAPH_LOCALE_MAP,
  LANDING_SOCIAL_DESCRIPTION_MAP,
  LANDING_SOCIAL_IMAGE_ALT_MAP,
  replaceExactlyOnce,
  stripLandingStaticBlock,
} from '@/landing/static';

import type { DocsChapterEntry } from '@/docs/catalog';

interface DocsSocialImage {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly alt: string;
}

export const DOCS_SOCIAL_IMAGE_MAP: Record<string, DocsSocialImage> = {
  purpose: {
    path: '/handbook/purpose.jpg',
    width: 1600,
    height: 678,
    alt: 'The desk device resting on a desk, its round face glowing with two capsule eyes.',
  },
  concepts: {
    path: '/handbook/concepts.jpg',
    width: 1600,
    height: 678,
    alt: 'One bright sphere holding an orbit of seven smaller states on hairline rings.',
  },
  loop: {
    path: '/handbook/loop.jpg',
    width: 1600,
    height: 678,
    alt: 'A waveform ribbon leaving a small device, looping through a cloud and returning.',
  },
  protocol: {
    path: '/handbook/protocol.jpg',
    width: 1600,
    height: 678,
    alt: 'Frames traveling in both directions between a small device and a server.',
  },
  capabilities: {
    path: '/handbook/capabilities.jpg',
    width: 1600,
    height: 678,
    alt: 'Small instruments laid out in a strict grid on a dark workbench.',
  },
  setup: {
    path: '/handbook/setup.jpg',
    width: 1600,
    height: 678,
    alt: 'A terminal cursor sending one line of light toward distant infrastructure.',
  },
  console: {
    path: '/handbook/console/connect.jpg',
    width: 1554,
    height: 784,
    alt: 'The console connect screen asking for a worker URL, a device name, and the dashboard secret.',
  },
  skills: {
    path: '/handbook/skills.jpg',
    width: 1600,
    height: 678,
    alt: 'An open handbook dissolving into threads of light received by a robotic hand.',
  },
  firmware: {
    path: '/handbook/firmware.jpg',
    width: 1600,
    height: 678,
    alt: 'Exploded view of the round device: glass, display, circuit board, speaker mesh, shell.',
  },
};

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
  const socialImage =
    chapterEntry === null ? null : (DOCS_SOCIAL_IMAGE_MAP[chapterEntry.slug] ?? null);
  if (socialImage !== null) {
    docsDocument = docsDocument.replaceAll(
      `${LANDING_PUBLIC_ORIGIN}/og.png`,
      `${LANDING_PUBLIC_ORIGIN}${socialImage.path}`,
    );
    docsDocument = replaceExactlyOnce(
      docsDocument,
      '<meta property="og:image:width" content="2400" />',
      `<meta property="og:image:width" content="${socialImage.width}" />`,
    );
    docsDocument = replaceExactlyOnce(
      docsDocument,
      '<meta property="og:image:height" content="1260" />',
      `<meta property="og:image:height" content="${socialImage.height}" />`,
    );
    docsDocument = docsDocument.replaceAll(
      LANDING_SOCIAL_IMAGE_ALT_MAP.es,
      socialImage.alt,
    );
    docsDocument = replaceExactlyOnce(
      docsDocument,
      '<meta property="og:type" content="website" />',
      '<meta property="og:type" content="article" />',
    );
  }
  return docsDocument;
}
