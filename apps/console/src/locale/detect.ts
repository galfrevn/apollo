export type Locale = 'es' | 'en';

export const SUPPORTED_LOCALE_LIST: readonly Locale[] = ['es', 'en'];

const LOCALE_STORAGE_KEY = 'apollo-console-locale';

function isSupportedLocale(candidate: string): candidate is Locale {
  return SUPPORTED_LOCALE_LIST.some((locale) => locale === candidate);
}

export function detectInitialLocale(
  storage: Storage,
  preferredLanguageList: readonly string[],
): Locale {
  const storedLocale = storage.getItem(LOCALE_STORAGE_KEY);
  if (storedLocale !== null && isSupportedLocale(storedLocale)) {
    return storedLocale;
  }
  for (const preferredLanguage of preferredLanguageList) {
    const primarySubtag = preferredLanguage.toLowerCase().split('-')[0];
    if (primarySubtag !== undefined && isSupportedLocale(primarySubtag)) {
      return primarySubtag;
    }
  }
  return 'es';
}

export function persistLocale(storage: Storage, locale: Locale): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}
