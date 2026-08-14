import { useRef } from 'react';

import { LandingCommand } from '@/landing/command';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { REDUCED_MOTION_SAFE_QUERY, RISE_EASE, gsap, useGSAP } from '@/landing/motion';
import { useMessages } from '@/locale/context';

export function LandingHero() {
  const landingMessages = useMessages(LANDING_MESSAGE_CATALOG);
  const heroReference = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        const entranceTimeline = gsap.timeline();
        entranceTimeline
          .from(
            '[data-hero-line]',
            { yPercent: 112, duration: 1, ease: RISE_EASE, stagger: 0.14 },
            0,
          )
          .from('[data-hero-foot]', { autoAlpha: 0, duration: 0.8 }, 0.65);
      });
    },
    { scope: heroReference },
  );

  return (
    <header
      ref={heroReference}
      className="relative flex min-h-svh flex-col justify-end pb-16 pt-[120px]"
    >
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <h1 className="font-serif text-[clamp(44px,11.5vw,156px)] leading-[0.98] tracking-[-0.02em]">
          <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
            <span data-hero-line className="block">
              {landingMessages.hero.lineOne}
            </span>
          </span>
          <span className="-mb-[0.12em] block overflow-hidden pb-[0.12em]">
            <span data-hero-line className="block">
              {landingMessages.hero.lineTwo}
              <span className="text-muted-foreground">.</span>
            </span>
          </span>
        </h1>
        <div
          data-hero-foot
          className="mt-16 flex flex-wrap items-end justify-between gap-10 border-t pt-7"
        >
          <p className="max-w-[44ch] text-sm text-muted-foreground">
            {landingMessages.hero.subhead}
          </p>
          <LandingCommand />
        </div>
      </div>
    </header>
  );
}
