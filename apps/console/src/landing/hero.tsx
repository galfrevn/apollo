import { useRef } from 'react';

import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP } from '@/landing/metadata';
import { REDUCED_MOTION_SAFE_QUERY, RISE_EASE, gsap, useGSAP } from '@/landing/motion';

export function LandingHero() {
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
        <h1 className="font-serif text-[clamp(64px,11.5vw,156px)] leading-[0.98] tracking-[-0.02em]">
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              Your personal
            </span>
          </span>
          <span className="block overflow-hidden">
            <span data-hero-line className="block">
              desk agent<span className="text-muted-foreground">.</span>
            </span>
          </span>
        </h1>
        <div
          data-hero-foot
          className="mt-16 flex flex-wrap items-end justify-between gap-10 border-t pt-7"
        >
          <p className="max-w-[44ch] text-sm text-muted-foreground">
            The open-source brain for physical agentic devices. It lives in your
            Cloudflare account; the body sits on your desk.
          </p>
          <div className="flex items-center gap-7 text-sm">
            <MagneticLink
              href={LANDING_LINK_MAP.github}
              isExternal
              className="underline-reveal"
            >
              GitHub
            </MagneticLink>
            <MagneticLink
              href={LANDING_LINK_MAP.documentation}
              isExternal
              className="underline-reveal"
            >
              Docs
            </MagneticLink>
            <MagneticLink
              href={LANDING_LINK_MAP.documentation}
              isExternal
              className="border px-4 py-2.5 transition-colors hover:border-border-hover hover:bg-card"
            >
              Getting started →
            </MagneticLink>
          </div>
        </div>
      </div>
    </header>
  );
}
