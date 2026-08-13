import { useEffect, useRef, useState } from 'react';

import { FaceCanvas } from '@/landing/face/canvas';
import { ActHeading } from '@/landing/heading';
import { REDUCED_MOTION_SAFE_QUERY, gsap, useGSAP } from '@/landing/motion';
import { CONVERSATION_TURN_LIST } from '@/landing/script';

import type { ReactNode } from 'react';

import type { LandingFaceEmotionName } from '@/landing/face/emotions';

const LIVE_EMOTION_CYCLE: readonly LandingFaceEmotionName[] = [
  'neutral',
  'curious',
  'focused',
  'talking',
];
const EMOTION_CYCLE_SECONDS = 2.6;
const WAVEFORM_BAR_COUNT = 22;

interface BentoCellProps {
  readonly label: string;
  readonly className?: string;
  readonly children: ReactNode;
}

function BentoCell({ label, className, children }: BentoCellProps) {
  return (
    <div
      className={`group flex flex-col gap-5 bg-card p-7 transition-colors duration-300 hover:bg-card-hover ${className ?? ''}`}
    >
      <span className="text-xs text-dim transition-colors duration-300 group-hover:text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  );
}

function useLiveClockText(): string {
  const [clockText, setClockText] = useState('00:00');
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(
        `${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`,
      );
    };
    updateClock();
    const intervalId = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(intervalId);
  }, []);
  return clockText;
}

export function LandingShowcase() {
  const sectionReference = useRef<HTMLElement | null>(null);
  const [liveEmotionIndex, setLiveEmotionIndex] = useState(0);
  const clockText = useLiveClockText();

  useGSAP(
    () => {
      const responsiveMotion = gsap.matchMedia();
      responsiveMotion.add(REDUCED_MOTION_SAFE_QUERY, () => {
        const intervalId = window.setInterval(() => {
          setLiveEmotionIndex(
            (previousIndex) => (previousIndex + 1) % LIVE_EMOTION_CYCLE.length,
          );
        }, EMOTION_CYCLE_SECONDS * 1000);
        return () => window.clearInterval(intervalId);
      });
    },
    { scope: sectionReference },
  );

  return (
    <section ref={sectionReference} id="listen" className="border-t py-[130px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <ActHeading indexLabel="01 · Listen">You talk. It talks back.</ActHeading>
        <div className="mt-16 md:ml-[220px]">
          <p
            data-reveal
            className="max-w-[720px] font-serif text-[clamp(20px,2.4vw,28px)] leading-[1.4] text-muted-foreground"
          >
            No app, no keyboard.{' '}
            <b className="font-normal text-foreground">You speak across the desk</b> and
            the answer comes back out loud, from a face that listens along.
          </p>
        </div>
        <div data-reveal className="mt-14 grid gap-px border bg-border md:grid-cols-3">
          <BentoCell label="The exchange" className="gap-6 md:col-span-2">
            {CONVERSATION_TURN_LIST.map((conversationTurn) => (
              <div key={conversationTurn.speakerLabel}>
                <div
                  className={`mb-1.5 text-xs ${
                    conversationTurn.isReply ? 'text-[#F5C518]' : 'text-dim'
                  }`}
                >
                  {conversationTurn.speakerLabel}
                </div>
                {conversationTurn.isReply ? (
                  <p className="max-w-[36ch] font-serif text-2xl leading-snug">
                    {conversationTurn.spokenText}
                  </p>
                ) : (
                  <p className="text-base text-muted-foreground">
                    {conversationTurn.spokenText}
                  </p>
                )}
              </div>
            ))}
          </BentoCell>
          <div className="group flex flex-col gap-6 bg-card p-7 transition-colors duration-300 hover:bg-card-hover md:row-span-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-dim transition-colors duration-300 group-hover:text-muted-foreground">
                Desk
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-foreground [animation:signal_2s_ease-in-out_infinite]"
                />
                Live
              </span>
            </div>
            <FaceCanvas
              mode="screen"
              emotion={LIVE_EMOTION_CYCLE[liveEmotionIndex]}
              gridResolution={14}
              shouldTrackPointer
              className="my-auto aspect-square w-full max-w-[220px] self-center"
            />
            <p className="text-sm text-muted-foreground">
              The face follows the turn: curious, focused, talking. It watches the cursor,
              too.
            </p>
          </div>
          <BentoCell label="The wake word">
            <div className="flex h-11 items-end gap-[3px]" aria-hidden>
              {Array.from({ length: WAVEFORM_BAR_COUNT }, (_, barIndex) => (
                <span
                  key={barIndex}
                  className="w-[3px] bg-[#3a3a3a] transition-colors duration-300 [animation:waveform_1.2s_ease-in-out_infinite] group-hover:bg-dim group-hover:[animation-duration:0.55s]"
                  style={{ animationDelay: `${(barIndex % 5) * 0.15}s` }}
                />
              ))}
            </div>
            <p className="mt-auto text-sm text-muted-foreground">
              It wakes on the phrase; only then does audio leave the desk.
            </p>
          </BentoCell>
          <BentoCell label="The reply">
            <p className="font-serif text-xl leading-snug">
              A sentence, spoken out loud.
            </p>
            <p className="mt-auto text-sm text-muted-foreground">
              Question to answer in one round trip, tuned for a desk.
            </p>
          </BentoCell>
          <BentoCell label="Memory">
            <div className="flex h-11 flex-col justify-end gap-2" aria-hidden>
              <span className="h-px w-full origin-left bg-[#2a2a2a] [animation:settlerow_3s_ease_infinite] group-hover:bg-dim" />
              <span
                className="h-px w-4/5 origin-left bg-[#2a2a2a] [animation:settlerow_3s_ease_infinite] group-hover:bg-dim"
                style={{ animationDelay: '0.4s' }}
              />
              <span
                className="h-px w-3/5 origin-left bg-[#2a2a2a] [animation:settlerow_3s_ease_infinite] group-hover:bg-dim"
                style={{ animationDelay: '0.8s' }}
              />
            </div>
            <p className="mt-auto text-sm text-muted-foreground">
              Say it once; it recalls it when it matters.
            </p>
          </BentoCell>
          <BentoCell label="Reminders">
            <div
              className="flex h-11 items-center font-mono text-xl text-muted-foreground tabular-nums transition-colors duration-300 group-hover:text-foreground"
              aria-hidden
            >
              {clockText}
            </div>
            <p className="mt-auto text-sm text-muted-foreground">
              Timers that fire on the device itself.
            </p>
          </BentoCell>
          <BentoCell label="Live answers">
            <div className="relative h-11 overflow-hidden border" aria-hidden>
              <span
                className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-foreground/10 to-transparent [animation:scanline_2.4s_linear_infinite] group-hover:[animation-duration:1.2s]"
                style={{ left: '-30%' }}
              />
            </div>
            <p className="mt-auto text-sm text-muted-foreground">
              Web research condensed into a sentence.
            </p>
          </BentoCell>
          <BentoCell label="Coding agent" className="md:col-span-2">
            <div
              className="flex h-11 items-center font-mono text-xs text-muted-foreground"
              aria-hidden
            >
              <span className="text-dim">$&nbsp;</span>
              apollo run · opening a pull request
              <span className="ml-1.5 inline-block h-3.5 w-[7px] bg-muted-foreground [animation:caret_1.1s_steps(1)_infinite]" />
            </div>
            <p className="mt-auto max-w-[52ch] text-sm text-muted-foreground">
              Real repository work, delegated with a sentence and reported back out loud.
            </p>
          </BentoCell>
          <BentoCell label="Your tools">
            <div className="flex h-11 items-center" aria-hidden>
              {Array.from({ length: 4 }, (_, nodeIndex) => (
                <span key={nodeIndex} className="contents">
                  {nodeIndex > 0 ? (
                    <span className="h-px flex-1 bg-[#2a2a2a] transition-colors duration-300 group-hover:bg-dim" />
                  ) : null}
                  <span
                    className="size-1.5 bg-muted-foreground [animation:signal_2s_ease-in-out_infinite]"
                    style={{ animationDelay: `${nodeIndex * 0.35}s` }}
                  />
                </span>
              ))}
            </div>
            <p className="mt-auto text-sm text-muted-foreground">
              The services you already use, over MCP.
            </p>
          </BentoCell>
        </div>
      </div>
    </section>
  );
}
