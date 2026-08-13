import { Suspense, lazy } from 'react';
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

if (surface.kind === 'redirect') {
  window.location.replace(surface.targetUrl);
} else {
  const LandingPage = lazy(() =>
    import('@/landing/page').then((module) => ({ default: module.LandingPage })),
  );
  const ConsoleApp = lazy(() =>
    import('@/app').then((module) => ({ default: module.App })),
  );
  createRoot(rootElement).render(
    <LocaleProvider>
      <Suspense fallback={null}>
        {surface.kind === 'landing' ? <LandingPage /> : <ConsoleApp />}
      </Suspense>
    </LocaleProvider>,
  );
}
