// The device reads text verbatim: leftover markdown gets pronounced out loud
// ("asterisco asterisco..."). The soul prompt already forbids markdown, but
// models slip, so everything headed for TTS passes through here — syntax is
// dropped, speakable content kept.
export function sanitizeTextForSpeech(text: string): string {
  return (
    text
      // Fence lines dropped, inner code kept — it still gets spoken.
      .replace(/^```[^\n]*$/gm, '')
      // Images before links so ![alt](url) resolves to just the alt text.
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/(\*\*|__)(.+?)\1/g, '$2')
      .replace(/\*([^*\n]+)\*/g, '$1')
      // Word-internal underscores (snake_case) are not emphasis.
      .replace(/(^|[^\w])_([^_\n]+)_(?=[^\w]|$)/gm, '$1$2')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/`([^`\n]+)`/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, '')
      // Unpaired emphasis runs that survived the pair rules above.
      .replace(/[*_]{2,}/g, '')
      .replace(/[ \t]+$/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}
