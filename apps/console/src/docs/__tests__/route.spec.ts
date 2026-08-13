import { describe, expect, it } from 'bun:test';

import { buildChapterPath, parseChapterSlugFromPathname } from '@/docs/route';

describe('parseChapterSlugFromPathname', () => {
  it('resolves the docs root to the contents view', () => {
    expect(parseChapterSlugFromPathname('/docs')).toBeNull();
    expect(parseChapterSlugFromPathname('/docs/')).toBeNull();
  });

  it('resolves known chapter paths to their slug', () => {
    expect(parseChapterSlugFromPathname('/docs/loop')).toBe('loop');
    expect(parseChapterSlugFromPathname('/docs/loop/')).toBe('loop');
  });

  it('falls back to the contents view for unknown chapters', () => {
    expect(parseChapterSlugFromPathname('/docs/nonsense')).toBeNull();
  });
});

describe('buildChapterPath', () => {
  it('builds the contents and chapter paths', () => {
    expect(buildChapterPath(null)).toBe('/docs');
    expect(buildChapterPath('loop')).toBe('/docs/loop');
  });
});
