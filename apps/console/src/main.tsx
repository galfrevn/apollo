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

// The template ships crawler-readable landing markup inside #root; mounting only
// after the surface module resolves keeps that markup visible until React can
// replace it with the live tree.
if (surface.kind === 'redirect') {
  window.location.replace(surface.targetUrl);
} else if (surface.kind === 'landing') {
  const { LandingPage } = await import('@/landing/page');
  createRoot(rootElement).render(
    <LocaleProvider
      localeOverride={surface.localeOverride}
      shouldDetectBrowserLanguage={false}
    >
      <LandingPage />
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
