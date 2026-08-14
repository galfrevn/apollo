import { useSyncExternalStore } from 'react';
import type { MouseEvent } from 'react';

import { findDocsChapterBySlug } from '@/docs/catalog';

export const ROADMAP_CHAPTER_SLUG = 'roadmap';

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

const HEADING_SCROLL_OFFSET = 96;
const HEADING_POLL_INTERVAL_MILLISECONDS = 16;
const HEADING_POLL_ATTEMPT_LIMIT = 30;

export function findChapterHeadingElement(headingText: string): HTMLElement | null {
  const headingElementList = document.querySelectorAll<HTMLElement>(
    'article h2, article h3',
  );
  for (const headingElement of headingElementList) {
    if (headingElement.textContent?.trim() === headingText) {
      return headingElement;
    }
  }
  return null;
}

// Streamdown headings carry no ids, so the chapter renders first and the heading
// is then found by its text. Polling uses timers rather than animation frames,
// which never fire while the document is hidden.
export function navigateToChapterHeading(chapterSlug: string, headingText: string): void {
  navigateToChapter(chapterSlug);
  let remainingAttemptCount = HEADING_POLL_ATTEMPT_LIMIT;
  const tryScrollToHeading = () => {
    const headingElement = findChapterHeadingElement(headingText);
    if (headingElement !== null) {
      window.scrollTo({
        top:
          headingElement.getBoundingClientRect().top +
          window.scrollY -
          HEADING_SCROLL_OFFSET,
      });
      return;
    }
    remainingAttemptCount -= 1;
    if (remainingAttemptCount > 0) {
      window.setTimeout(tryScrollToHeading, HEADING_POLL_INTERVAL_MILLISECONDS);
    }
  };
  tryScrollToHeading();
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
