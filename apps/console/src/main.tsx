import { createRoot } from 'react-dom/client';

import '@/index.css';
import { LocaleProvider } from '@/locale/context';
import { resolveSurfaceFromLocation } from '@/router/path';

const rootElement = document.getElementById('root');
if (rootElement === null) {
  throw new Error('Missing #root element');
}

const surface = resolveSurfaceFromLocation(
  window.location.pathname,
  window.location.hash,
);

// The template ships crawler-readable landing markup inside #root, hidden by
// index.css whenever the data-scripting attribute is present; if the landing
// chunk never arrives, dropping the attribute reveals that markup as fallback.
if (surface.kind === 'redirect') {
  window.location.replace(surface.targetUrl);
} else if (surface.kind === 'landing') {
  let landingModule: typeof import('@/landing/page');
  try {
    landingModule = await import('@/landing/page');
  } catch (importFailure) {
    document.documentElement.removeAttribute('data-scripting');
    throw importFailure;
  }
  const { LandingPage } = landingModule;
  createRoot(rootElement).render(
    <LocaleProvider
      localeOverride={surface.localeOverride}
      shouldDetectBrowserLanguage={false}
    >
      <LandingPage />
    </LocaleProvider>,
  );
} else if (surface.kind === 'docs') {
  const { DocsPage } = await import('@/docs/page');
  createRoot(rootElement).render(
    <LocaleProvider>
      <DocsPage />
    </LocaleProvider>,
  );
} else {
  const { App } = await import('@/app');
  createRoot(rootElement).render(
    <LocaleProvider>
      <App />
    </LocaleProvider>,
  );
}
