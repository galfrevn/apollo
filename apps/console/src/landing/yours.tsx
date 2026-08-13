import { ActHeading } from '@/landing/heading';
import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP } from '@/landing/metadata';

const OWNERSHIP_CARD_LIST = [
  {
    label: 'The brain',
    description: 'Voice turns, memory, tools, and schedules in one Durable Object.',
    action: 'One command to deploy.',
  },
  {
    label: 'The body',
    description: 'The firmware for the device on your desk.',
    action: 'Flash it. Set it down.',
  },
];

export function LandingYours() {
  return (
    <section id="yours" className="border-t py-[130px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <ActHeading indexLabel="04 · Yours">
          Runs on your account. Answers to no one else.
        </ActHeading>
        <div className="mt-16 md:ml-[220px]">
          <p
            data-reveal
            className="max-w-[34ch] font-serif text-[clamp(20px,2.4vw,26px)] leading-[1.4] text-muted-foreground"
          >
            Open source, end to end: the memory, the media, the keys.{' '}
            <span className="text-foreground">Deploy it once and it’s yours.</span>
          </p>
        </div>
        <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {OWNERSHIP_CARD_LIST.map((ownershipCard, cardIndex) => (
            <div
              key={ownershipCard.label}
              data-reveal
              data-reveal-delay={cardIndex * 0.08}
              className="flex flex-col gap-3 border bg-card p-6"
            >
              <span className="text-xs text-dim">{ownershipCard.label}</span>
              <p className="text-sm text-muted-foreground">{ownershipCard.description}</p>
              <div className="mt-auto pt-4">
                <p className="text-sm">{ownershipCard.action}</p>
              </div>
            </div>
          ))}
          <div
            data-reveal
            data-reveal-delay="0.16"
            className="flex flex-col gap-3 border bg-card p-6"
          >
            <span className="text-xs text-dim">The docs</span>
            <p className="text-sm text-muted-foreground">
              A handbook for every part: protocol, memory, persona, operations.
            </p>
            <div className="mt-auto pt-4">
              <a
                href={LANDING_LINK_MAP.documentation}
                target="_blank"
                rel="noreferrer"
                className="underline-reveal text-sm"
              >
                Read the docs →
              </a>
            </div>
          </div>
          <div
            data-reveal
            data-reveal-delay="0.24"
            className="flex flex-col gap-3 border bg-card p-6"
          >
            <span className="text-xs text-dim">The console</span>
            <p className="text-sm text-muted-foreground">
              Everything it knows and plans, live from your worker.
            </p>
            <div className="mt-auto pt-4">
              <MagneticLink
                href={LANDING_LINK_MAP.console}
                className="inline-block bg-primary px-4 py-2.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open console →
              </MagneticLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
