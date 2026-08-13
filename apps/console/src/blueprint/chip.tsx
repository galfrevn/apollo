import { cn } from '@/components/utility';

export type ChipTone = 'live' | 'idle' | 'busy' | 'down';

const CHIP_TONE_CLASS_MAP: Record<ChipTone, { frame: string; dot: string }> = {
  live: {
    frame: 'border-border bg-accent text-foreground',
    dot: 'bg-foreground animate-[signal_2s_ease-in-out_infinite]',
  },
  busy: {
    frame: 'border-border bg-accent text-foreground',
    dot: 'bg-foreground animate-[signal_1s_ease-in-out_infinite]',
  },
  idle: {
    frame: 'border-border bg-accent text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
  down: {
    frame: 'border-destructive/40 bg-transparent text-destructive',
    dot: 'bg-destructive',
  },
};

export function Chip({
  tone,
  children,
  className,
}: {
  readonly tone: ChipTone;
  readonly children: string;
  readonly className?: string;
}) {
  const toneClass = CHIP_TONE_CLASS_MAP[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-medium',
        toneClass.frame,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', toneClass.dot)} />
      {children}
    </span>
  );
}
