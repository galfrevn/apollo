import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { RefObject } from 'react';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export const REDUCED_MOTION_SAFE_QUERY = '(prefers-reduced-motion: no-preference)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';
export const RISE_EASE = 'expo.out';

export function prefersReducedMotion(): boolean {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

export function useScrollReveal(scopeReference: RefObject<HTMLElement | null>): void {
  useGSAP(
    () => {
      const scopeElement = scopeReference.current;
      if (scopeElement === null) {
        return;
      }
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        const revealTargetList = gsap.utils.toArray<HTMLElement>(
          '[data-reveal]',
          scopeElement,
        );
        for (const revealTarget of revealTargetList) {
          gsap.from(revealTarget, {
            autoAlpha: 0,
            y: 16,
            duration: 0.7,
            ease: RISE_EASE,
            delay: Number(revealTarget.dataset.revealDelay ?? '0'),
            scrollTrigger: { trigger: revealTarget, start: 'top 85%', once: true },
          });
        }
      });
    },
    { scope: scopeReference },
  );
}

export { gsap, ScrollTrigger, useGSAP };
