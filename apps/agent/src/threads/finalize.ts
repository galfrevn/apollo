import { z } from 'zod';

import type { SessionMessage } from 'agents/experimental/memory/session';

import type { OpenRouterChatMessage } from '@/voice/llm';

export const COMMAND_THREAD_MAX_USER_TURNS = 2;
export const THREAD_FINALIZATION_TRANSCRIPT_BYTE_BUDGET = 24_000;
const THREAD_TITLE_MAX_LENGTH = 60;

export const finalizeThreadPayloadSchema = z.object({
  sessionId: z.string().min(1),
});

const threadDigestResultSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(1_000),
});

export type ThreadDigestResult = z.infer<typeof threadDigestResultSchema>;

function extractSpokenText(message: SessionMessage): string {
  return message.parts
    .filter((part) => part.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join(' ')
    .trim();
}

export function classifyThreadMessages(
  messageList: readonly SessionMessage[],
): 'command' | 'conversation' {
  const spokenUserTurnCount = messageList.filter(
    (message) => message.role === 'user' && extractSpokenText(message).length > 0,
  ).length;
  return spokenUserTurnCount <= COMMAND_THREAD_MAX_USER_TURNS
    ? 'command'
    : 'conversation';
}

export function buildFallbackThreadTitle(
  messageList: readonly SessionMessage[],
): string | undefined {
  for (const message of messageList) {
    if (message.role !== 'user') {
      continue;
    }
    const spokenText = extractSpokenText(message);
    if (spokenText.length === 0) {
      continue;
    }
    return spokenText.length <= THREAD_TITLE_MAX_LENGTH
      ? spokenText
      : `${spokenText.slice(0, THREAD_TITLE_MAX_LENGTH - 1)}…`;
  }
  return undefined;
}

export function flattenThreadMessagesToTranscript(
  messageList: readonly SessionMessage[],
): string {
  const lineList: string[] = [];
  for (const message of messageList) {
    const spokenText = extractSpokenText(message);
    if (spokenText.length === 0) {
      continue;
    }
    const speakerLabel = message.role === 'user' ? 'Usuario' : 'Apollo';
    lineList.push(`${speakerLabel}: ${spokenText}`);
  }
  return lineList.join('\n');
}

export function buildThreadDigestMessageList(
  transcriptText: string,
): readonly OpenRouterChatMessage[] {
  return [
    {
      role: 'system',
      content:
        'Sos el archivista de un asistente de escritorio por voz. Recibís la transcripción de una conversación ya cerrada entre el dueño y el asistente. Respondé SOLO con un objeto JSON con esta forma exacta: {"title": string, "summary": string}. El título: máximo 8 palabras, en español, sin comillas, describe el tema. El resumen: 2 a 4 oraciones en español con lo importante (decisiones, pendientes, datos concretos) para poder retomar la conversación más adelante.',
    },
    {
      role: 'user',
      content: transcriptText,
    },
  ];
}

export function parseThreadDigestResult(rawText: string): ThreadDigestResult | undefined {
  // Models wrap JSON in fences or prose despite instructions; the outermost
  // brace pair is the only part worth trying to parse.
  const withoutFences = rawText.replace(/```(?:json)?/gi, '');
  const firstBraceIndex = withoutFences.indexOf('{');
  const lastBraceIndex = withoutFences.lastIndexOf('}');
  if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return undefined;
  }
  try {
    const parsedResult = threadDigestResultSchema.safeParse(
      JSON.parse(withoutFences.slice(firstBraceIndex, lastBraceIndex + 1)),
    );
    return parsedResult.success ? parsedResult.data : undefined;
  } catch {
    return undefined;
  }
}

export type ThreadFinalizationDependencies = {
  readonly getThreadMessages: () => Promise<readonly SessionMessage[]>;
  readonly generateThreadDigest: (
    transcriptText: string,
  ) => Promise<ThreadDigestResult | undefined>;
  readonly renameThread: (title: string) => Promise<void>;
  readonly persistOutcome: (outcome: {
    readonly kind: 'command' | 'conversation';
    readonly title: string | null;
    readonly summary: string | null;
  }) => Promise<void>;
};

export async function runThreadFinalization(
  dependencies: ThreadFinalizationDependencies,
): Promise<void> {
  const messageList = await dependencies.getThreadMessages();
  const kind = classifyThreadMessages(messageList);
  const fallbackTitle = buildFallbackThreadTitle(messageList);

  if (kind === 'command') {
    if (fallbackTitle !== undefined) {
      await dependencies.renameThread(fallbackTitle);
    }
    await dependencies.persistOutcome({
      kind,
      title: fallbackTitle ?? null,
      summary: null,
    });
    return;
  }

  const digest = await dependencies.generateThreadDigest(
    flattenThreadMessagesToTranscript(messageList),
  );
  if (digest === undefined) {
    if (fallbackTitle !== undefined) {
      await dependencies.renameThread(fallbackTitle);
    }
    await dependencies.persistOutcome({
      kind,
      title: fallbackTitle ?? null,
      summary: null,
    });
    return;
  }
  await dependencies.renameThread(digest.title);
  await dependencies.persistOutcome({
    kind,
    title: digest.title,
    summary: digest.summary,
  });
}
