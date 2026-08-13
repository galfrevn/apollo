import { cn } from '@/components/utility';

export function Empty({
  message,
  className,
}: {
  readonly message: string;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        'dotted-bg flex min-h-24 items-center justify-center border border-dashed px-4 py-8',
        className,
      )}
    >
      <p className="bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">
        {message}
      </p>
    </div>
  );
}
