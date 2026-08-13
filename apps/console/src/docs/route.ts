import { useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';

import { findDocsChapterBySlug } from '@/docs/catalog';

export const DOCS_BASE_PATH = '/docs';

const NAVIGATION_EVENT_NAME = 'docs:navigation';

export function parseChapterSlugFromPathname(pathname: string): string | null {
  const candidate = pathname.startsWith(DOCS_BASE_PATH)
    ? pathname.slice(DOCS_BASE_PATH.length).replace(/^\/+/, '').replace(/\/+$/, '')
    : '';
  if (candidate === '') {
    return null;
  }
  return findDocsChapterBySlug(candidate)?.slug ?? null;
}

export function buildChapterPath(chapterSlug: string | null): string {
  return chapterSlug === null ? DOCS_BASE_PATH : `${DOCS_BASE_PATH}/${chapterSlug}`;
}

function subscribeToNavigation(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange);
  window.addEventListener(NAVIGATION_EVENT_NAME, onChange);
  return () => {
    window.removeEventListener('popstate', onChange);
    window.removeEventListener(NAVIGATION_EVENT_NAME, onChange);
  };
}

export function useDocsChapterSlug(): string | null {
  return useSyncExternalStore(subscribeToNavigation, () =>
    parseChapterSlugFromPathname(window.location.pathname),
  );
}

export function navigateToChapter(chapterSlug: string | null): void {
  window.history.pushState(null, '', buildChapterPath(chapterSlug));
  window.dispatchEvent(new Event(NAVIGATION_EVENT_NAME));
  window.scrollTo({ top: 0 });
}

export function handleChapterLinkClick(
  event: MouseEvent<HTMLAnchorElement>,
  chapterSlug: string | null,
): void {
  const shouldLetBrowserHandleClick =
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey;
  if (shouldLetBrowserHandleClick) {
    return;
  }
  event.preventDefault();
  navigateToChapter(chapterSlug);
}
