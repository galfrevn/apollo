const APOLLO_WORDMARK_LINE_LIST = [
  '▄▀█ █▀█ █▀█ █   █   █▀█',
  '█▀█ █▀▀ █▄█ █▄▄ █▄▄ █▄█',
] as const;

const ANSI_DIM_SEQUENCE = '\u001b[2m';
const ANSI_RESET_SEQUENCE = '\u001b[0m';

export function printWizardBanner(taglineText: string): void {
  const wordmarkBlock = APOLLO_WORDMARK_LINE_LIST.join('\n');
  console.log(
    `\n${wordmarkBlock}\n${ANSI_DIM_SEQUENCE}${taglineText}${ANSI_RESET_SEQUENCE}\n`,
  );
}
