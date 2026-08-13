import { useClipboard } from '@/components/clipboard';
import { Icons } from '@/components/icons';
import { LANDING_MESSAGE_CATALOG } from '@/landing/copy/catalog';
import { LANDING_COMMAND_MAP } from '@/landing/metadata';
import { useMessages } from '@/locale/context';

export function LandingCommand() {
  const startMessages = useMessages(LANDING_MESSAGE_CATALOG).start;
  const { isCopied, copyTextToClipboard } = useClipboard();

  return (
    <button
      type="button"
      onClick={() => copyTextToClipboard(LANDING_COMMAND_MAP.bun)}
      aria-label={startMessages.copyCommandLabel}
      className="group flex items-center gap-3 border px-4 py-2.5 font-mono text-sm transition-colors duration-150 hover:border-border-hover hover:bg-card"
    >
      <span aria-hidden className="text-dim">
        $
      </span>
      <span>{LANDING_COMMAND_MAP.bun}</span>
      <span
        aria-hidden
        className="inline-block h-3.5 w-[7px] bg-muted-foreground [animation:caret_1.1s_steps(1)_infinite]"
      />
      {isCopied ? (
        <Icons.Check size={14} className="text-foreground" />
      ) : (
        <Icons.Copy
          size={14}
          className="text-dim transition-colors duration-150 group-hover:text-foreground"
        />
      )}
      <span aria-live="polite" className="sr-only">
        {isCopied ? startMessages.copiedLabel : ''}
      </span>
    </button>
  );
}
