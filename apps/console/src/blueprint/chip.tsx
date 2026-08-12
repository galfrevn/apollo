import { cn } from '@/components/utility';

export type ChipTone = 'live' | 'idle' | 'busy' | 'down';

const CHIP_TONE_CLASS_MAP: Record<ChipTone, { frame: string; dot: string }> = {
  live: {
    frame: 'border-amber/40 bg-amberdim text-amber',
    dot: 'bg-amber animate-[signal_2s_ease-in-out_infinite]',
  },
  busy: {
    frame: 'border-ink/25 bg-raised text-ink',
    dot: 'bg-ink animate-[signal_1s_ease-in-out_infinite]',
  },
  idle: { frame: 'border-line bg-raised text-muted', dot: 'bg-muted' },
  down: { frame: 'border-line bg-transparent text-faint', dot: 'bg-faint' },
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
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        toneClass.frame,
        className,
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-[1px]', toneClass.dot)} />
      {children}
    </span>
  );
}
