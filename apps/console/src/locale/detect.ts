export type Locale = 'es' | 'en';

export const SUPPORTED_LOCALE_LIST: readonly Locale[] = ['es', 'en'];

const LOCALE_STORAGE_KEY = 'apollo-console-locale';

function isSupportedLocale(candidate: string): candidate is Locale {
  return SUPPORTED_LOCALE_LIST.some((locale) => locale === candidate);
}

export function detectInitialLocale(
  storage: Storage | null,
  preferredLanguageList: readonly string[],
): Locale {
  let storedLocale: string | null = null;
  try {
    storedLocale = storage === null ? null : storage.getItem(LOCALE_STORAGE_KEY);
  } catch {
    // Privacy-mode rejection: continue with browser preferences or Spanish.
  }
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

export function persistLocale(storage: Storage | null, locale: Locale): void {
  if (storage === null) {
    return;
  }
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Quota or privacy-mode rejection: the choice still applies for this session.
  }
}
