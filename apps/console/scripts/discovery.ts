import { mkdir } from 'node:fs/promises';

import { buildConsoleDocument, buildLandingDocument } from '@/landing/static';
import { CONSOLE_ROUTE_LIST } from '@/router/route';

const distDirectoryUrl = new URL('../dist/', import.meta.url);
const templateFileUrl = new URL('index.html', distDirectoryUrl);

const templateHtml = await Bun.file(templateFileUrl).text();

await Bun.write(templateFileUrl, buildLandingDocument(templateHtml, 'es'));
await Bun.write(
  new URL('en.html', distDirectoryUrl),
  buildLandingDocument(templateHtml, 'en'),
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

process.stdout.write(
  `discovery: wrote index.html, en.html, and ${CONSOLE_ROUTE_LIST.length + 1} console shells\n`,
);
