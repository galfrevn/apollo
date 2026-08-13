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

export function LocaleProvider({ children }: { readonly children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectInitialLocale(resolveBrowserStorage(), navigator.languages),
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    persistLocale(resolveBrowserStorage(), nextLocale);
    setLocaleState(nextLocale);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
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
