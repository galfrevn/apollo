import { useEffect } from 'react';
import type { MouseEvent } from 'react';

import { LANDING_MESSAGES } from '@/landing/copy/text';
import { ActHeading } from '@/landing/heading';
import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP } from '@/landing/metadata';
import { ScrollSmoother } from '@/landing/motion';
import { warmConsoleChunk, warmDocsChunk } from '@/landing/prefetch';
import { LandingStart } from '@/landing/start';

// ScrollSmoother transforms the pinned content instead of scrolling the page,
// so native hash navigation lands at the wrong position while it is active.
function handleAnchorActivation(clickEvent: MouseEvent<HTMLAnchorElement>): void {
  const isPlainLeftClick =
    clickEvent.button === 0 &&
    !clickEvent.metaKey &&
    !clickEvent.ctrlKey &&
    !clickEvent.shiftKey &&
    !clickEvent.altKey;
  if (!isPlainLeftClick) {
    return;
  }
  const smoother = ScrollSmoother.get();
  if (smoother) {
    clickEvent.preventDefault();
    const targetHash = clickEvent.currentTarget.hash;
    smoother.scrollTo(targetHash, true);
    if (window.location.hash !== targetHash) {
      window.history.pushState(null, '', targetHash);
    }
  }
}

// The hash can arrive from outside this page, so it is not guaranteed to be a
// valid selector; querySelector throws on malformed input.
function findAnchorTargetElement(targetHash: string): Element | null {
  try {
    return targetHash === '' ? null : document.querySelector(targetHash);
  } catch {
    return null;
  }
}

function useAnchorHistoryRestoration(): void {
  useEffect(() => {
    const handleHistoryTraversal = () => {
      const smoother = ScrollSmoother.get();
      if (!smoother) {
        return;
      }
      smoother.scrollTo(findAnchorTargetElement(window.location.hash) ?? 0, true);
    };
    if (window.location.hash !== '') {
      handleHistoryTraversal();
    }
    window.addEventListener('popstate', handleHistoryTraversal);
    return () => window.removeEventListener('popstate', handleHistoryTraversal);
  }, []);
}

export function LandingYours() {
  const yoursMessages = LANDING_MESSAGES.yours;
  useAnchorHistoryRestoration();
  return (
    <section id="yours" className="border-t py-[130px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <ActHeading indexLabel={yoursMessages.actIndexLabel}>
          {yoursMessages.actTitle}
        </ActHeading>
        <div className="mt-16 md:ml-[220px]">
          <p
            data-reveal
            className="max-w-[34ch] font-serif text-[clamp(20px,2.4vw,26px)] leading-[1.4] text-muted-foreground"
          >
            {yoursMessages.introLead}
            <span className="text-foreground">{yoursMessages.introEmphasis}</span>
          </p>
        </div>
        <LandingStart />
        <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {yoursMessages.ownershipCardList.map((ownershipCard, cardIndex) => (
            <div
              key={ownershipCard.label}
              data-reveal
              data-reveal-delay={cardIndex * 0.08}
              className="flex flex-col gap-3 border bg-card p-6"
            >
              <h3 className="text-xs font-normal text-dim">{ownershipCard.label}</h3>
              <p className="text-sm text-muted-foreground">{ownershipCard.description}</p>
              <div className="mt-auto pt-4">
                {ownershipCard.actionTargetId === null ? (
                  <p className="text-sm">{ownershipCard.action}</p>
                ) : (
                  <a
                    href={`#${ownershipCard.actionTargetId}`}
                    onClick={handleAnchorActivation}
                    className="underline-reveal text-sm"
                  >
                    {ownershipCard.action}
                  </a>
                )}
              </div>
            </div>
          ))}
          <div
            data-reveal
            data-reveal-delay="0.16"
            className="flex flex-col gap-3 border bg-card p-6"
          >
            <h3 className="text-xs font-normal text-dim">
              {yoursMessages.docsCardLabel}
            </h3>
            <p className="text-sm text-muted-foreground">
              {yoursMessages.docsCardDescription}
            </p>
            <div className="mt-auto pt-4">
              <a
                href={LANDING_LINK_MAP.documentation}
                onPointerEnter={warmDocsChunk}
                onFocus={warmDocsChunk}
                className="underline-reveal text-sm"
              >
                {yoursMessages.docsCardAction}
              </a>
            </div>
          </div>
          <div
            data-reveal
            data-reveal-delay="0.24"
            className="flex flex-col gap-3 border bg-card p-6"
          >
            <h3 className="text-xs font-normal text-dim">
              {yoursMessages.consoleCardLabel}
            </h3>
            <p className="text-sm text-muted-foreground">
              {yoursMessages.consoleCardDescription}
            </p>
            <div className="mt-auto pt-4">
              <MagneticLink
                href={LANDING_LINK_MAP.console}
                onWarm={warmConsoleChunk}
                className="inline-block bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {yoursMessages.consoleCardAction}
              </MagneticLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
