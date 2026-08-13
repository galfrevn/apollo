import type { SessionMessage } from 'agents/experimental/memory/session';

import { flattenThreadMessagesToTranscript } from '@/threads/finalize';

export const THREAD_HANDOFF_BYTE_BUDGET = 1_200;

export function buildThreadHandoffNote(input: {
  readonly previousThreadTitle: string;
  readonly messageList: readonly SessionMessage[];
  readonly byteBudget?: number;
}): string | undefined {
  const byteBudget = input.byteBudget ?? THREAD_HANDOFF_BYTE_BUDGET;
  const transcriptText = flattenThreadMessagesToTranscript(input.messageList);
  if (transcriptText.length === 0) {
    return undefined;
  }
  let transcriptTail = transcriptText;
  if (transcriptTail.length > byteBudget) {
    const truncated = transcriptTail.slice(-byteBudget);
    const firstLineBreakIndex = truncated.indexOf('\n');
    transcriptTail =
      firstLineBreakIndex === -1 ? truncated : truncated.slice(firstLineBreakIndex + 1);
  }
  const titleFragment =
    input.previousThreadTitle.length > 0 ? ` ("${input.previousThreadTitle}")` : '';
  return `La conversación anterior${titleFragment} se cerró por inactividad. Últimos intercambios, por si el usuario retoma el tema:\n${transcriptTail}`;
}
