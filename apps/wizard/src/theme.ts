import { log } from '@clack/prompts';
import picocolors from 'picocolors';

const PHASE_HEADER_TOTAL_WIDTH = 52;

export const TOTAL_PHASE_COUNT = 5;

export function renderPhaseHeader(input: {
  readonly stepNumber?: number;
  readonly totalStepCount?: number;
  readonly title: string;
}): void {
  const numberingPrefix =
    input.stepNumber !== undefined && input.totalStepCount !== undefined
      ? `${input.stepNumber}/${input.totalStepCount} · `
      : '';
  const headline = `${numberingPrefix}${input.title}`;
  const trailingRuleWidth = Math.max(4, PHASE_HEADER_TOTAL_WIDTH - headline.length);
  log.message(
    `${picocolors.bold(picocolors.yellow(headline))} ${picocolors.dim('─'.repeat(trailingRuleWidth))}`,
    { symbol: picocolors.yellow('◆──') },
  );
}

export function renderSuccessLine(headline: string, detailText?: string): void {
  const detailSuffix =
    detailText === undefined ? '' : ` ${picocolors.dim(`· ${detailText}`)}`;
  log.message(`${picocolors.green(headline)}${detailSuffix}`, {
    symbol: picocolors.green('✓'),
  });
}

export function renderFailureLine(headline: string, hintText?: string): void {
  log.message(picocolors.red(headline), { symbol: picocolors.red('✗') });
  if (hintText !== undefined) {
    renderMutedLine(hintText);
  }
}

export function renderMutedLine(text: string): void {
  log.message(picocolors.dim(text));
}
