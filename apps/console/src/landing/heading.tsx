import type { ReactNode } from 'react';

interface ActHeadingProps {
  readonly indexLabel: string;
  readonly children: ReactNode;
}

export function ActHeading({ indexLabel, children }: ActHeadingProps) {
  return (
    <div
      className="grid gap-3 md:grid-cols-[180px_1fr] md:gap-10 items-start"
      data-reveal
    >
      <span className="font-mono text-xs text-dim md:pt-3.5">{indexLabel}</span>
      <h2 className="font-serif text-[clamp(34px,5vw,60px)] leading-[1.08] tracking-[-0.015em] max-w-[20ch]">
        {children}
      </h2>
    </div>
  );
}
