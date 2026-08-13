import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { detectInitialLocale, persistLocale } from '@/locale/detect';
import type { Locale } from '@/locale/detect';

type LocaleContextValue = {
  readonly locale: Locale;
  readonly setLocale: (nextLocale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

// Reading window.localStorage throws a SecurityError when the browser denies
// storage access (privacy settings, sandboxed embeds); the app must still boot.
function resolveBrowserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const LANDING_PATH_LIST = ['/', '/en', '/en/'];

export function LocaleProvider({
  children,
  localeOverride = null,
  shouldDetectBrowserLanguage = true,
}: {
  readonly children: ReactNode;
  readonly localeOverride?: Locale | null;
  readonly shouldDetectBrowserLanguage?: boolean;
}) {
  // Search crawlers render with english browser preferences, so the landing
  // must not let navigator.languages flip the content away from the URL's
  // canonical language; only an explicit stored choice may.
  const [locale, setLocaleState] = useState<Locale>(
    () =>
      localeOverride ??
      detectInitialLocale(
        resolveBrowserStorage(),
        shouldDetectBrowserLanguage ? navigator.languages : [],
      ),
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    persistLocale(resolveBrowserStorage(), nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const landingPathForLocale = locale === 'en' ? '/en' : '/';
    const currentPathname = window.location.pathname;
    if (
      LANDING_PATH_LIST.includes(currentPathname) &&
      currentPathname !== landingPathForLocale
    ) {
      window.history.replaceState(null, '', landingPathForLocale);
    }
  }, [locale]);

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const contextValue = useContext(LocaleContext);
  if (contextValue === null) {
    throw new Error('useLocale must be used within a LocaleProvider');
  }
  return contextValue;
}

export function useMessages<MessageShape>(
  catalog: Record<Locale, MessageShape>,
): MessageShape {
  const { locale } = useLocale();
  return catalog[locale];
}
