import { useEffect, useState } from 'react';
import { z } from 'zod';

import { Icons } from '@/components/icons';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP } from '@/landing/metadata';
import { warmConsoleChunk } from '@/landing/prefetch';
import { useMessages } from '@/locale/context';

const REPOSITORY_API_URL = 'https://api.github.com/repos/galfrevn/apollo';
const repositorySchema = z.object({ stargazers_count: z.number() });

function formatStarCount(starCount: number): string {
  return starCount >= 1000 ? `${(starCount / 1000).toFixed(1)}k` : String(starCount);
}

function useGithubStarCount(): number | null {
  const [starCount, setStarCount] = useState<number | null>(null);
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
        }
      } catch {
        // Offline or rate limited: the nav simply hides the count.
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
  const starCount = useGithubStarCount();

  return (
    <nav aria-label="Apollo" className="fixed inset-x-0 top-0 z-10">
      <div
        aria-hidden
        className="absolute inset-0 -bottom-4 bg-gradient-to-b from-background/70 to-background/0 backdrop-blur-md [mask-image:linear-gradient(to_bottom,black_40%,transparent)]"
      />
      <div className="relative mx-auto flex h-[68px] max-w-[1180px] items-center justify-between px-8">
        <a href="/" className="flex items-center gap-3 font-serif text-lg">
          <Icons.LogoMark size={26} />
          Apollo
        </a>
        <div className="flex items-center gap-7 text-sm text-muted-foreground">
          <a
            href={LANDING_LINK_MAP.documentation}
            target="_blank"
            rel="noreferrer"
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
            className="bg-primary px-3.5 py-2 text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {landingMessages.nav.openConsoleLabel}
          </MagneticLink>
        </div>
      </div>
    </nav>
  );
}
