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
        'pixelfield flex min-h-24 items-center justify-center rounded-lg border border-dashed border-line px-4 py-8',
        className,
      )}
    >
      <p className="label-soft rounded-md bg-panel px-2.5 py-1 text-faint">{message}</p>
    </div>
  );
}
