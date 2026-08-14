import { useEffect, useState } from 'react';

const WAKE_PHRASE_LIST = ['heyapolo', 'heyapollo'] as const;
const WAKE_BUFFER_LIMIT = 24;
const WAKE_ECHO_MILLISECONDS = 2600;

export function normalizeWakeCharacter(key: string): string | null {
  if (key.length !== 1) {
    return null;
  }
  const stripped = key
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /^[a-z]$/.test(stripped) ? stripped : null;
}

export function appendToWakeBuffer(buffer: string, key: string): string {
  const character = normalizeWakeCharacter(key);
  if (character === null) {
    return buffer;
  }
  return (buffer + character).slice(-WAKE_BUFFER_LIMIT);
}

export function matchesWakePhrase(buffer: string): boolean {
  return WAKE_PHRASE_LIST.some((wakePhrase) => buffer.endsWith(wakePhrase));
}

// Tested against the word being typed rather than the rolling buffer: any
// suffix match would treat the "h" ending "with" as a wake prefix and swallow
// the space that follows it.
export function isWakePhrasePrefix(currentWord: string): boolean {
  return (
    currentWord !== '' &&
    WAKE_PHRASE_LIST.some((wakePhrase) => wakePhrase.startsWith(currentWord))
  );
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

export function useWakeEcho(): { wakeSignal: number; isAwake: boolean } {
  const [wakeSignal, setWakeSignal] = useState(0);
  const [isAwake, setIsAwake] = useState(false);

  useEffect(() => {
    let buffer = '';
    let currentWord = '';
    // Only a letter typed plainly on the document continues the word; every
    // other key ends it, so no interruption can leave a stale prefix behind to
    // swallow a later space.
    const handleKeyDown = (event: KeyboardEvent) => {
      const isPlainTyping =
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !isTypingTarget(event.target);
      // Space pages the document down, which would yank the reader away
      // mid-phrase; it is only swallowed while the wake word is being typed.
      if (isPlainTyping && event.key === ' ') {
        if (isWakePhrasePrefix(currentWord)) {
          event.preventDefault();
        }
        currentWord = '';
        return;
      }
      const character = isPlainTyping ? normalizeWakeCharacter(event.key) : null;
      if (character === null) {
        currentWord = '';
        return;
      }
      currentWord = (currentWord + character).slice(-WAKE_BUFFER_LIMIT);
      buffer = appendToWakeBuffer(buffer, event.key);
      if (matchesWakePhrase(buffer)) {
        buffer = '';
        currentWord = '';
        setWakeSignal((previousSignal) => previousSignal + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (wakeSignal === 0) {
      return;
    }
    setIsAwake(true);
    const timeoutId = window.setTimeout(() => setIsAwake(false), WAKE_ECHO_MILLISECONDS);
    return () => window.clearTimeout(timeoutId);
  }, [wakeSignal]);

  return { wakeSignal, isAwake };
}
