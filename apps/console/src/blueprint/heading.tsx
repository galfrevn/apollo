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
    <div className={cn(className)}>
      <h1 className="text-xl font-medium tracking-tight">{children}</h1>
      {description !== undefined && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
