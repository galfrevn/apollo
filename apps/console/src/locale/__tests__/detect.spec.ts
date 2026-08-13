import { describe, expect, it } from 'bun:test';

import { detectInitialLocale, persistLocale } from '@/locale/detect';

function buildMemoryStorage(
  initialEntryList: readonly (readonly [string, string])[] = [],
) {
  const entryMap = new Map<string, string>(initialEntryList);
  const memoryStorage: Storage = {
    get length() {
      return entryMap.size;
    },
    clear: () => entryMap.clear(),
    getItem: (key) => entryMap.get(key) ?? null,
    key: (index) => [...entryMap.keys()][index] ?? null,
    removeItem: (key) => {
      entryMap.delete(key);
    },
    setItem: (key, value) => {
      entryMap.set(key, value);
    },
  };
  return memoryStorage;
}

describe('detectInitialLocale', () => {
  it('prefers a stored valid locale over browser languages', () => {
    const storage = buildMemoryStorage([['apollo-console-locale', 'en']]);
    expect(detectInitialLocale(storage, ['es-AR'])).toBe('en');
  });

  it('ignores an invalid stored value', () => {
    const storage = buildMemoryStorage([['apollo-console-locale', 'fr']]);
    expect(detectInitialLocale(storage, ['en-US'])).toBe('en');
  });

  it('resolves Spanish from a regional Spanish browser language', () => {
    expect(detectInitialLocale(buildMemoryStorage(), ['es-AR', 'en-US'])).toBe('es');
  });

  it('resolves English from an English browser language', () => {
    expect(detectInitialLocale(buildMemoryStorage(), ['en-GB'])).toBe('en');
  });

  it('skips unsupported languages until a supported one appears', () => {
    expect(detectInitialLocale(buildMemoryStorage(), ['fr-FR', 'en-GB'])).toBe('en');
  });

  it('defaults to Spanish when no supported language appears', () => {
    expect(detectInitialLocale(buildMemoryStorage(), ['fr-FR'])).toBe('es');
  });

  it('defaults to Spanish for an empty language list', () => {
    expect(detectInitialLocale(buildMemoryStorage(), [])).toBe('es');
  });
});

describe('persistLocale', () => {
  it('round-trips through detection', () => {
    const storage = buildMemoryStorage();
    persistLocale(storage, 'en');
    expect(detectInitialLocale(storage, ['es-AR'])).toBe('en');
  });
});
