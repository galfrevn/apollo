import { useRef } from 'react';

import { REDUCED_MOTION_SAFE_QUERY, RISE_EASE, gsap, useGSAP } from '@/landing/motion';

const ECHO_WORD_LIST = ['The', 'desk', 'is', 'listening'];

export function LandingFooter() {
  const footerReference = useRef<HTMLElement | null>(null);

  useGSAP(
    () => {
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        gsap.from('[data-echo-word]', {
          yPercent: 112,
          duration: 0.9,
          ease: RISE_EASE,
          stagger: 0.09,
          scrollTrigger: {
            trigger: footerReference.current,
            start: 'top 70%',
            once: true,
          },
        });
      });
    },
    { scope: footerReference },
  );

  return (
    <footer ref={footerReference} className="border-t pb-14 pt-[120px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <p className="mb-20 flex flex-wrap items-center gap-x-[0.24em] font-serif text-[clamp(48px,9vw,120px)] leading-[1.05] tracking-[-0.02em]">
          {ECHO_WORD_LIST.map((echoWord, echoWordIndex) => {
            const isLastEchoWord = echoWordIndex === ECHO_WORD_LIST.length - 1;
            return (
              <span key={echoWord} className="block overflow-hidden">
                <span data-echo-word className="flex items-center whitespace-nowrap">
                  {echoWord}
                  {isLastEchoWord ? (
                    <span
                      aria-hidden
                      className="ml-[0.08em] inline-block h-[0.75em] w-[0.14em] bg-foreground [animation:caret_1.2s_steps(1)_infinite]"
                    />
                  ) : null}
                </span>
              </span>
            );
          })}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-5 text-xs text-dim">
          <span className="font-serif text-sm">“Hey, Apollo.”</span>
          <span>
            Built by{' '}
            <a
              href="https://github.com/galfrevn"
              target="_blank"
              rel="noreferrer"
              className="underline-reveal text-muted-foreground hover:text-foreground"
            >
              @galfrevn
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
