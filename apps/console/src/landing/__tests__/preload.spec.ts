import { describe, expect, it } from 'bun:test';

import {
  collectLandingPreloadPathList,
  injectModulePreloadLinkList,
  parseBuildManifest,
} from '@/landing/preload';

const fakeBuildManifest = parseBuildManifest({
  'src/landing/page.tsx': {
    file: 'assets/page-abc123.js',
    imports: ['_shared-def456.js', '_motion-ghi789.js'],
  },
  '_shared-def456.js': {
    file: 'assets/shared-def456.js',
    imports: ['_motion-ghi789.js'],
  },
  '_motion-ghi789.js': {
    file: 'assets/motion-ghi789.js',
  },
  'src/main.tsx': {
    file: 'assets/index-entry00.js',
    imports: ['_shared-def456.js'],
  },
});

describe('landing preload path collection', () => {
  it('walks imports transitively from the landing entry without duplicates', () => {
    const preloadPathList = collectLandingPreloadPathList(
      fakeBuildManifest,
      'src/landing/page.tsx',
    );
    expect(preloadPathList).toEqual([
      '/assets/page-abc123.js',
      '/assets/shared-def456.js',
      '/assets/motion-ghi789.js',
    ]);
  });

  it('throws when the landing entry is missing from the manifest', () => {
    expect(() =>
      collectLandingPreloadPathList(fakeBuildManifest, 'src/landing/missing.tsx'),
    ).toThrow('Build manifest drift');
  });
});

describe('modulepreload injection', () => {
  it('inserts links for unreferenced paths before the head close tag', () => {
    const documentHtml = '<html><head><title>Apollo</title></head><body></body></html>';
    const injectedDocument = injectModulePreloadLinkList(documentHtml, [
      '/assets/page-abc123.js',
    ]);
    expect(injectedDocument).toContain(
      '<link rel="modulepreload" crossorigin href="/assets/page-abc123.js" /></head>',
    );
  });

  it('skips paths the document already references', () => {
    const documentHtml =
      '<html><head><link rel="modulepreload" href="/assets/shared-def456.js" /></head><body></body></html>';
    const injectedDocument = injectModulePreloadLinkList(documentHtml, [
      '/assets/shared-def456.js',
      '/assets/page-abc123.js',
    ]);
    expect(injectedDocument).toContain('href="/assets/page-abc123.js"');
    expect(injectedDocument.match(/shared-def456\.js/g)).toHaveLength(1);
  });

  it('throws when the document has no head close tag', () => {
    expect(() => injectModulePreloadLinkList('<html><body></body></html>', [])).toThrow(
      'Discovery template drift',
    );
  });
});
