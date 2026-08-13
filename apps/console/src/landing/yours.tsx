import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { ActHeading } from '@/landing/heading';
import { MagneticLink } from '@/landing/magnet';
import { LANDING_LINK_MAP } from '@/landing/metadata';
import { useMessages } from '@/locale/context';

export function LandingYours() {
  const yoursMessages = useMessages(LANDING_MESSAGE_CATALOG).yours;
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
        <div className="mt-14 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {yoursMessages.ownershipCardList.map((ownershipCard, cardIndex) => (
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
            <span className="text-xs text-dim">{yoursMessages.docsCardLabel}</span>
            <p className="text-sm text-muted-foreground">
              {yoursMessages.docsCardDescription}
            </p>
            <div className="mt-auto pt-4">
              <a
                href={LANDING_LINK_MAP.documentation}
                target="_blank"
                rel="noreferrer"
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
            <span className="text-xs text-dim">{yoursMessages.consoleCardLabel}</span>
            <p className="text-sm text-muted-foreground">
              {yoursMessages.consoleCardDescription}
            </p>
            <div className="mt-auto pt-4">
              <MagneticLink
                href={LANDING_LINK_MAP.console}
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
