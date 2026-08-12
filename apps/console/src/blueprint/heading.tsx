import { cn } from '@/components/utility';

export function Heading({
  children,
  description,
  className,
}: {
  readonly children: string;
  readonly description?: string;
  readonly className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span
        aria-hidden
        className="mt-[0.55em] grid shrink-0 grid-cols-2 gap-0.5 opacity-80"
      >
        <span className="size-1 bg-amber" />
        <span className="size-1 bg-amber/40" />
        <span className="size-1 bg-amber/40" />
        <span className="size-1 bg-amber/15" />
      </span>
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{children}</h1>
        {description !== undefined && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
    </div>
  );
}
