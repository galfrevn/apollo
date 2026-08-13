import { useRef } from 'react';

import { LandingArchitecture } from '@/landing/architecture';
import { LandingCapabilities } from '@/landing/capabilities/section';
import { LandingFooter } from '@/landing/footer';
import { LandingHero } from '@/landing/hero';
import { useLandingMetadata } from '@/landing/metadata';
import { useScrollReveal, useSmoothScroll } from '@/landing/motion';
import { LandingNav } from '@/landing/nav';
import { LandingShowcase } from '@/landing/showcase';
import { LandingYours } from '@/landing/yours';

export function LandingPage() {
  useLandingMetadata();
  const pageReference = useRef<HTMLDivElement | null>(null);

  useScrollReveal(pageReference);
  useSmoothScroll();

  return (
    <div ref={pageReference} className="overflow-x-clip">
      <LandingNav />
      <div id="smooth-wrapper">
        <div id="smooth-content">
          <main>
            <LandingHero />
            <LandingShowcase />
            <LandingArchitecture />
            <LandingCapabilities />
            <LandingYours />
          </main>
          <LandingFooter />
        </div>
      </div>
    </div>
  );
}
