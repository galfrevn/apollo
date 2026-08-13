import type { ReactNode } from 'react';

import { cn } from '@/components/utility';

export function Panel({
  title,
  meta,
  children,
  className,
}: {
  readonly title?: string;
  readonly meta?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}) {
  return (
    <section className={cn('overflow-hidden border bg-card', className)}>
      {title !== undefined && (
        <header className="flex h-11 items-center justify-between border-b px-4">
          <h2 className="text-sm text-muted-foreground">{title}</h2>
          {meta}
        </header>
      )}
      {children}
    </section>
  );
}
