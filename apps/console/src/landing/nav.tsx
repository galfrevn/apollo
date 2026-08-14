import { useEffect, useState } from 'react';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP, LANDING_LOCALE_PATH_MAP } from '@/landing/metadata';
import { scrollLandingToTop } from '@/landing/motion';
import { warmConsoleChunk, warmDocsChunk } from '@/landing/prefetch';
import { useLocale, useMessages } from '@/locale/context';

import type { MouseEvent } from 'react';

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

const REPOSITORY_API_URL = 'https://api.github.com/repos/galfrevn/apollo';
const STAR_COUNT_STORAGE_KEY = 'apollo:github-star-count';
const repositorySchema = z.object({ stargazers_count: z.number() });
const storedStarCountSchema = z.coerce.number().int().nonnegative();

function formatStarCount(starCount: number): string {
  return starCount >= 1000 ? `${(starCount / 1000).toFixed(1)}k` : String(starCount);
}

function readStoredStarCount(): number | null {
  try {
    const storedValue = window.localStorage.getItem(STAR_COUNT_STORAGE_KEY);
    if (storedValue === null || storedValue === '') {
      return null;
    }
    const parsedValue = storedStarCountSchema.safeParse(storedValue);
    return parsedValue.success ? parsedValue.data : null;
  } catch {
    return null;
  }
}

function useGithubStarCount(): number | null {
  const [starCount, setStarCount] = useState<number | null>(readStoredStarCount);
  useEffect(() => {
    let isCancelled = false;
    const loadStarCount = async () => {
      try {
        const response = await fetch(REPOSITORY_API_URL);
        if (!response.ok) {
          return;
        }
        const payload: unknown = await response.json();
        const parsedRepository = repositorySchema.safeParse(payload);
        if (!isCancelled && parsedRepository.success) {
          setStarCount(parsedRepository.data.stargazers_count);
          try {
            window.localStorage.setItem(
              STAR_COUNT_STORAGE_KEY,
              String(parsedRepository.data.stargazers_count),
            );
          } catch {
            // Storage full or blocked: the next visit just refetches.
          }
        }
      } catch {
        // Offline or rate limited: the nav shows the cached count or nothing.
      }
    };
    void loadStarCount();
    return () => {
      isCancelled = true;
    };
  }, []);
  return starCount;
}

export function LandingNav() {
  const landingMessages = useMessages(LANDING_MESSAGE_CATALOG);
  const { locale } = useLocale();
  const starCount = useGithubStarCount();
  const landingPath = LANDING_LOCALE_PATH_MAP[locale];

  return (
    <nav aria-label="Apollo" className="fixed inset-x-0 top-0 z-10">
      <div
        aria-hidden
        className="absolute inset-0 -bottom-4 bg-gradient-to-b from-background/70 to-background/0 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      />
      <div className="relative mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-5 sm:px-8">
        <a
          href={landingPath}
          onClick={(event) => {
            if (!isPlainLeftClick(event)) {
              return;
            }
            event.preventDefault();
            scrollLandingToTop();
          }}
          className="flex items-center gap-3 font-serif text-lg"
        >
          <Icons.LogoMark size={26} />
          <span className="max-sm:hidden">Apollo</span>
        </a>
        <div className="flex items-center gap-4 text-sm text-muted-foreground sm:gap-7">
          <a
            href={LANDING_LINK_MAP.documentation}
            onPointerEnter={warmDocsChunk}
            onFocus={warmDocsChunk}
            className="underline-reveal hover:text-foreground"
          >
            {landingMessages.nav.docsLabel}
          </a>
          <a
            href={LANDING_LINK_MAP.github}
            target="_blank"
            rel="noreferrer"
            className="underline-reveal flex items-center gap-1.5 hover:text-foreground"
          >
            {landingMessages.nav.githubLabel}
            {starCount === null ? null : (
              <span className="flex items-center gap-0.5 text-xs text-dim">
                <Icons.Star size={13} />
                {formatStarCount(starCount)}
              </span>
            )}
          </a>
          <MagneticLink
            href={LANDING_LINK_MAP.console}
            onWarm={warmConsoleChunk}
            className="bg-primary px-2.5 py-1.5 text-primary-foreground transition-colors hover:bg-primary/90 sm:px-3.5 sm:py-2"
          >
            {landingMessages.nav.openConsoleLabel}
          </MagneticLink>
        </div>
      </div>
    </nav>
  );
}
