import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

import type { RefObject } from 'react';

gsap.registerPlugin(useGSAP, ScrollSmoother, ScrollTrigger);

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

export function scrollLandingToTop(): void {
  if (prefersReducedMotion()) {
    window.scrollTo({ top: 0 });
    return;
  }
  const smoother = ScrollSmoother.get();
  if (smoother === undefined) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  smoother.scrollTo(0, true);
}

export function isElementInViewport(element: HTMLElement): boolean {
  const bounds = element.getBoundingClientRect();
  return (
    bounds.top < window.innerHeight * 0.85 && bounds.bottom > window.innerHeight * 0.15
  );
}

export function scrollElementIntoView(element: HTMLElement): void {
  if (prefersReducedMotion()) {
    element.scrollIntoView({ block: 'center' });
    return;
  }
  const smoother = ScrollSmoother.get();
  if (smoother === undefined) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  smoother.scrollTo(element, true, 'center center');
}

export function useSmoothScroll(): void {
  useGSAP(() => {
    const responsiveMotion = gsap.matchMedia();
    responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
      const smoother = ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1,
      });
      return () => smoother.kill();
    });
  });
}

export { gsap, ScrollSmoother, ScrollTrigger, useGSAP };
