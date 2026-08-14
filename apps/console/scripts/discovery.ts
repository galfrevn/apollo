import { mkdir, rm } from 'node:fs/promises';

import { DOCS_CHAPTER_LIST_MAP } from '@/docs/catalog';
import { buildDocsDocument } from '@/docs/static';
import {
  collectLandingPreloadPathList,
  injectModulePreloadLinkList,
  LANDING_PAGE_MANIFEST_KEY,
  parseBuildManifest,
} from '@/landing/preload';
import { buildConsoleDocument, buildLandingDocument } from '@/landing/static';
import { CONSOLE_ROUTE_LIST } from '@/router/route';

const DOCS_PAGE_MANIFEST_KEY = 'src/docs/page.tsx';

const distDirectoryUrl = new URL('../dist/', import.meta.url);
const templateFileUrl = new URL('index.html', distDirectoryUrl);
const manifestDirectoryUrl = new URL('.vite/', distDirectoryUrl);

const templateHtml = await Bun.file(templateFileUrl).text();
const buildManifest = parseBuildManifest(
  await Bun.file(new URL('manifest.json', manifestDirectoryUrl)).json(),
);
const landingPreloadPathList = collectLandingPreloadPathList(
  buildManifest,
  LANDING_PAGE_MANIFEST_KEY,
);

await Bun.write(
  templateFileUrl,
  injectModulePreloadLinkList(
    buildLandingDocument(templateHtml, 'es'),
    landingPreloadPathList,
  ),
);
await Bun.write(
  new URL('en.html', distDirectoryUrl),
  injectModulePreloadLinkList(
    buildLandingDocument(templateHtml, 'en'),
    landingPreloadPathList,
  ),
);

const consoleDocumentHtml = buildConsoleDocument(templateHtml);
await mkdir(new URL('console/', distDirectoryUrl), { recursive: true });
await Bun.write(new URL('console.html', distDirectoryUrl), consoleDocumentHtml);
for (const consoleRoute of CONSOLE_ROUTE_LIST) {
  await Bun.write(
    new URL(`console/${consoleRoute}.html`, distDirectoryUrl),
    consoleDocumentHtml,
  );
}

const docsPreloadPathList = collectLandingPreloadPathList(
  buildManifest,
  DOCS_PAGE_MANIFEST_KEY,
);
await mkdir(new URL('docs/', distDirectoryUrl), { recursive: true });
await Bun.write(
  new URL('docs.html', distDirectoryUrl),
  injectModulePreloadLinkList(buildDocsDocument(templateHtml, null), docsPreloadPathList),
);
for (const chapterEntry of DOCS_CHAPTER_LIST_MAP.en) {
  await Bun.write(
    new URL(`docs/${chapterEntry.slug}.html`, distDirectoryUrl),
    injectModulePreloadLinkList(
      buildDocsDocument(templateHtml, chapterEntry),
      docsPreloadPathList,
    ),
  );
}

await rm(manifestDirectoryUrl, { recursive: true, force: true });

process.stdout.write(
  `discovery: wrote index.html, en.html, ${CONSOLE_ROUTE_LIST.length + 1} console shells, and ${DOCS_CHAPTER_LIST_MAP.en.length + 1} docs documents\n`,
);
