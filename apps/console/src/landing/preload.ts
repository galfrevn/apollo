import { z } from 'zod';

export const LANDING_PAGE_MANIFEST_KEY = 'src/landing/page.tsx';

const buildManifestChunkSchema = z.object({
  file: z.string(),
  imports: z.array(z.string()).optional(),
});

const buildManifestSchema = z.record(z.string(), buildManifestChunkSchema);

export type BuildManifest = z.infer<typeof buildManifestSchema>;

export function parseBuildManifest(rawManifest: unknown): BuildManifest {
  return buildManifestSchema.parse(rawManifest);
}

export function collectLandingPreloadPathList(
  buildManifest: BuildManifest,
  entryManifestKey: string,
): readonly string[] {
  const landingEntryChunk = buildManifest[entryManifestKey];
  if (landingEntryChunk === undefined) {
    throw new Error(`Build manifest drift: missing entry "${entryManifestKey}"`);
  }
  const visitedManifestKeySet = new Set<string>();
  const preloadPathList: string[] = [];
  const pendingManifestKeyList = [entryManifestKey];
  while (pendingManifestKeyList.length > 0) {
    const currentManifestKey = pendingManifestKeyList.shift();
    if (
      currentManifestKey === undefined ||
      visitedManifestKeySet.has(currentManifestKey)
    ) {
      continue;
    }
    visitedManifestKeySet.add(currentManifestKey);
    const currentChunk = buildManifest[currentManifestKey];
    if (currentChunk === undefined) {
      continue;
    }
    preloadPathList.push(`/${currentChunk.file}`);
    pendingManifestKeyList.push(...(currentChunk.imports ?? []));
  }
  return preloadPathList;
}

export function injectModulePreloadLinkList(
  documentHtml: string,
  preloadPathList: readonly string[],
): string {
  const headCloseTag = '</head>';
  if (!documentHtml.includes(headCloseTag)) {
    throw new Error('Discovery template drift: missing </head>');
  }
  const missingPathList = preloadPathList.filter(
    (preloadPath) => !documentHtml.includes(preloadPath),
  );
  if (missingPathList.length === 0) {
    return documentHtml;
  }
  const preloadLinkList = missingPathList
    .map(
      (preloadPath) => `<link rel="modulepreload" crossorigin href="${preloadPath}" />`,
    )
    .join('');
  return documentHtml.replace(headCloseTag, `${preloadLinkList}${headCloseTag}`);
}
