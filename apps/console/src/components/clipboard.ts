import { useCallback, useEffect, useRef, useState } from 'react';

const COPY_FEEDBACK_DURATION_MS = 2000;

export async function copyTextUsingWriter(
  writeText: (text: string) => Promise<void>,
  text: string,
): Promise<boolean> {
  try {
    await writeText(text);
    return true;
  } catch {
    return false;
  }
}

// The Clipboard API is secure-context only and can be absent or throw when the
// browser denies access (permissions policy, sandboxed embeds); copying must
// fail silently instead of crashing the page.
function resolveClipboardWriter(): ((text: string) => Promise<void>) | null {
  try {
    const clipboard = navigator.clipboard;
    return clipboard ? (text) => clipboard.writeText(text) : null;
  } catch {
    return null;
  }
}

export function useClipboard(): {
  readonly isCopied: boolean;
  readonly copyTextToClipboard: (text: string) => void;
} {
  const [isCopied, setIsCopied] = useState(false);
  const feedbackTimerReference = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (feedbackTimerReference.current !== null) {
        clearTimeout(feedbackTimerReference.current);
      }
    };
  }, []);

  const copyTextToClipboard = useCallback((text: string) => {
    const writeText = resolveClipboardWriter();
    if (writeText === null) {
      return;
    }
    const showCopiedFeedback = async () => {
      const didCopy = await copyTextUsingWriter(writeText, text);
      if (!didCopy) {
        return;
      }
      setIsCopied(true);
      if (feedbackTimerReference.current !== null) {
        clearTimeout(feedbackTimerReference.current);
      }
      feedbackTimerReference.current = setTimeout(() => {
        setIsCopied(false);
        feedbackTimerReference.current = null;
      }, COPY_FEEDBACK_DURATION_MS);
    };
    void showCopiedFeedback();
  }, []);

  return { isCopied, copyTextToClipboard };
}
