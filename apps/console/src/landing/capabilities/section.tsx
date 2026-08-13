import { CAPABILITY_ROW_LIST } from '@/landing/capabilities/catalog';
import { ActHeading } from '@/landing/heading';

export function LandingCapabilities() {
  return (
    <section id="act" className="border-t py-[130px]">
      <div className="mx-auto w-full max-w-[1180px] px-8">
        <ActHeading indexLabel="03 · Act">Small talk is not the point.</ActHeading>
        <div className="mt-16 md:ml-[220px]">
          <p
            data-reveal
            className="max-w-[720px] font-serif text-[clamp(20px,2.4vw,28px)] leading-[1.4] text-muted-foreground"
          >
            Apollo exists to get things done:{' '}
            <b className="font-normal text-foreground">
              remember, remind, research, and ship
            </b>
            , all from a sentence spoken across the desk.
          </p>
        </div>
        <div className="mt-14 border-t">
          {CAPABILITY_ROW_LIST.map((capabilityRow, rowIndex) => (
            <div
              key={capabilityRow.indexLabel}
              data-reveal
              data-reveal-delay={rowIndex * 0.07}
              className="group grid grid-cols-[60px_1fr] items-center gap-6 border-b py-7 transition-[padding,background-color] duration-300 hover:bg-gradient-to-r hover:from-card hover:to-transparent hover:pl-4 md:grid-cols-[90px_240px_1fr_140px]"
            >
              <span className="font-mono text-xs text-dim transition-colors duration-300 group-hover:text-foreground">
                {capabilityRow.indexLabel}
              </span>
              <span className="flex items-center gap-3 font-serif text-2xl">
                {capabilityRow.name}
                <span
                  aria-hidden
                  className="-translate-x-2 font-mono text-[15px] text-muted-foreground opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                >
                  →
                </span>
              </span>
              <p className="col-start-2 max-w-[48ch] text-sm text-muted-foreground md:col-start-3">
                {capabilityRow.description}
              </p>
              <span className="hidden items-center justify-end gap-2 text-xs text-dim transition-colors duration-300 group-hover:text-foreground md:flex">
                <span
                  aria-hidden
                  className="size-[5px] rounded-full bg-foreground opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-hover:[animation:signal_1.4s_ease-in-out_infinite]"
                />
                {capabilityRow.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
