import { useRef } from 'react';

import { LANDING_MESSAGES } from '@/landing/copy/text';
import { FaceCanvas } from '@/landing/face/canvas';
import { ActHeading } from '@/landing/heading';
import { REDUCED_MOTION_SAFE_QUERY, RISE_EASE, gsap, useGSAP } from '@/landing/motion';
import { useWakeEcho } from '@/landing/wake';

export function LandingArchitecture() {
  const architectureMessages = LANDING_MESSAGES.architecture;
  const sectionReference = useRef<HTMLElement | null>(null);
  const { wakeSignal, isAwake } = useWakeEcho();

  useGSAP(
    () => {
      const sectionElement = sectionReference.current;
      if (sectionElement === null) {
        return;
      }
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        const drawTimeline = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-diagram]',
            start: 'top 78%',
            once: true,
          },
        });
        drawTimeline
          .from('[data-diagram-node]', {
            autoAlpha: 0,
            y: 10,
            duration: 0.55,
            ease: RISE_EASE,
            stagger: 0.1,
          })
          .from(
            '[data-diagram-wire]',
            { scaleX: 0, duration: 0.5, ease: 'power2.inOut' },
            0.25,
          )
          .fromTo(
            '[data-diagram-branch]',
            { strokeDashoffset: 1 },
            { strokeDashoffset: 0, duration: 0.5, ease: 'power2.inOut', stagger: 0.12 },
            0.5,
          )
          .fromTo(
            '[data-diagram-pulse]',
            { left: '0%', autoAlpha: 0 },
            {
              left: '100%',
              duration: 2.4,
              repeat: -1,
              repeatDelay: 2.6,
              ease: 'none',
              keyframes: [
                { autoAlpha: 1, duration: 0.3 },
                { autoAlpha: 1, duration: 1.8 },
                { autoAlpha: 0, duration: 0.3 },
              ],
            },
            1,
          )
          .fromTo(
            '[data-diagram-return]',
            { left: '100%', autoAlpha: 0 },
            {
              left: '0%',
              duration: 2.4,
              repeat: -1,
              repeatDelay: 2.6,
              ease: 'none',
              keyframes: [
                { autoAlpha: 1, duration: 0.3 },
                { autoAlpha: 1, duration: 1.8 },
                { autoAlpha: 0, duration: 0.3 },
              ],
            },
            3.5,
          );
      });
    },
    { scope: sectionReference },
  );

  return (
    <section ref={sectionReference} id="think" className="border-t py-[130px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <ActHeading indexLabel={architectureMessages.actIndexLabel}>
          {architectureMessages.actTitle}
        </ActHeading>
        <div className="mt-16 md:ml-[220px]">
          <p
            className="max-w-[720px] font-serif text-[clamp(20px,2.4vw,28px)] leading-[1.4] text-muted-foreground"
            data-reveal
          >
            {architectureMessages.intro.lead}
            <b className="font-normal text-foreground">
              {architectureMessages.intro.emphasis}
            </b>
            {architectureMessages.intro.trail}
          </p>
        </div>
        <div
          data-diagram
          data-reveal
          className="mt-14 grid items-stretch md:grid-cols-[1fr_88px_1.25fr_88px_1fr]"
        >
          <div data-diagram-node className="flex flex-col gap-4 border bg-card p-6">
            <span className="text-xs text-dim">{architectureMessages.bodyNodeLabel}</span>
            <FaceCanvas
              mode="screen"
              emotion={isAwake ? 'curious' : 'neutral'}
              gridResolution={14}
              wakeSignal={wakeSignal}
              className="size-14 self-center"
            />
            <div className="mt-auto">
              <p className="text-sm">{architectureMessages.bodyNodeHeadline}</p>
              <p className="mt-1 text-xs text-dim">
                {architectureMessages.bodyNodeDetail}
              </p>
            </div>
          </div>
          <div aria-hidden className="mx-auto h-8 w-px bg-[#3a3a3a] md:hidden" />
          <div className="relative hidden flex-col items-center justify-center gap-2 px-2 md:flex">
            <span className="text-xs text-dim">
              {architectureMessages.voiceWireLabel}
            </span>
            <div className="relative w-full">
              <div data-diagram-wire className="h-px w-full origin-left bg-[#3a3a3a]" />
              <span
                data-diagram-pulse
                aria-hidden
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 bg-foreground opacity-0"
              />
              <span
                data-diagram-return
                aria-hidden
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 bg-foreground opacity-0"
              />
            </div>
            <span className="text-xs text-dim">
              {architectureMessages.replyWireLabel}
            </span>
          </div>
          <div data-diagram-node className="flex flex-col gap-4 border bg-card p-7">
            <span className="text-xs text-dim">
              {architectureMessages.brainNodeLabel}
            </span>
            <p className="max-w-[18ch] font-serif text-2xl leading-snug">
              {architectureMessages.brainNodeHeadline}
            </p>
            <div className="mt-auto">
              <p className="font-mono text-xs leading-relaxed text-muted-foreground">
                {architectureMessages.brainNodeMonoLine}
              </p>
              <p className="mt-1 text-xs text-dim">
                {architectureMessages.brainNodeDetail}
              </p>
            </div>
          </div>
          <div aria-hidden className="mx-auto h-8 w-px bg-[#3a3a3a] md:hidden" />
          <div className="relative hidden md:block">
            <svg
              aria-hidden
              className="absolute inset-0 size-full"
              viewBox="0 0 88 100"
              preserveAspectRatio="none"
            >
              <path
                data-diagram-branch
                d="M0 50 C 44 50, 44 17, 88 17"
                pathLength={1}
                strokeDasharray="1"
                stroke="#3a3a3a"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-diagram-branch
                d="M0 50 H 88"
                pathLength={1}
                strokeDasharray="1"
                stroke="#3a3a3a"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
              <path
                data-diagram-branch
                d="M0 50 C 44 50, 44 83, 88 83"
                pathLength={1}
                strokeDasharray="1"
                stroke="#3a3a3a"
                fill="none"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>
          <div className="flex flex-col justify-between gap-3">
            {architectureMessages.toolNodeList.map((toolNode) => (
              <div
                key={toolNode.name}
                data-diagram-node
                className="flex flex-1 flex-col justify-center gap-1 border bg-card px-5 py-4"
              >
                <span className="text-xs text-dim">{toolNode.name}</span>
                <p className="text-sm text-muted-foreground">{toolNode.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
