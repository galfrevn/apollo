import type { SessionMessage } from 'agents/experimental/memory/session';
import { z } from 'zod';

import type { OpenRouterChatMessage } from '@/voice/llm';

export const OWNER_MEMORY_TRANSCRIPT_BYTE_BUDGET = 48_000;
export const OWNER_MEMORY_MAX_FACT_COUNT = 50;
export const OWNER_MEMORY_STALE_FACT_WINDOW_MS = 60 * 24 * 60 * 60_000;
// Fits comfortably inside the memory block's 1100-token budget.
export const OWNER_MEMORY_BLOCK_MAX_CHARACTERS = 4_000;
export const OWNER_MEMORY_MIN_RUN_INTERVAL_MS = 20 * 60 * 60_000;
// The DO scheduler evaluates cron in UTC: 06:00 UTC is 03:00 in Buenos Aires.
export const OWNER_MEMORY_CONSOLIDATION_CRON = '0 6 * * *';

export const ownerFactCategorySchema = z.enum([
  'preference',
  'fact',
  'context',
  'relationship',
]);

export type OwnerFactCategory = z.infer<typeof ownerFactCategorySchema>;

const ownerFactSchema = z.object({
  id: z.string().min(1),
  content: z.string().min(1),
  category: ownerFactCategorySchema,
  lastConfirmedAtMilliseconds: z.number(),
  sourceCount: z.number().int().min(1),
});

export type OwnerFact = {
  readonly id: string;
  readonly content: string;
  readonly category: OwnerFactCategory;
  readonly lastConfirmedAtMilliseconds: number;
  readonly sourceCount: number;
};

const ownerMemoryStateSchema = z.object({
  factList: z.array(ownerFactSchema),
  lastConsolidatedAtMilliseconds: z.number(),
  lastProcessedLeafId: z.string().optional(),
});

export type OwnerMemoryState = {
  readonly factList: readonly OwnerFact[];
  readonly lastConsolidatedAtMilliseconds: number;
  readonly lastProcessedLeafId?: string;
};

export const memoryExtractionResultSchema = z.object({
  newFactList: z
    .array(
      z.object({
        content: z.string().min(1).max(300),
        category: ownerFactCategorySchema,
      }),
    )
    .max(20),
  reinforcedFactIdList: z.array(z.string()).max(80),
  staleFactIdList: z.array(z.string()).max(80),
});

export type MemoryExtractionResult = z.infer<typeof memoryExtractionResultSchema>;

export function flattenRecentHistoryToTranscript(
  messageList: readonly SessionMessage[],
): string {
  const lineList: string[] = [];
  for (const message of messageList) {
    const spokenText = message.parts
      .flatMap((part) =>
        part.type === 'text' && part.text !== undefined ? [part.text] : [],
      )
      .join(' ')
      .trim();
    if (spokenText.length === 0) {
      continue;
    }
    const speakerLabel = message.role === 'user' ? 'Usuario' : 'Apollo';
    lineList.push(`${speakerLabel}: ${spokenText}`);
  }
  return lineList.join('\n');
}

const EXTRACTION_SYSTEM_PROMPT = [
  'Sos el módulo de memoria de Apollo, un asistente de escritorio. Analizás la',
  'transcripción reciente de conversaciones con su dueño y mantenés una lista de',
  'hechos duraderos sobre esa persona: preferencias, datos personales, contexto',
  'en curso (proyectos, trabajo, rutinas) y relaciones (personas, mascotas).',
  'Ignorá lo efímero: timers, clima, pedidos puntuales ya resueltos.',
  '',
  'Respondé únicamente con JSON válido, sin markdown ni texto adicional, con',
  'esta forma exacta:',
  '{"newFactList":[{"content":"una oración en español, máximo 300 caracteres",',
  '"category":"preference"|"fact"|"context"|"relationship"}],',
  '"reinforcedFactIdList":["id de un hecho existente que la transcripción vuelve a confirmar"],',
  '"staleFactIdList":["id de un hecho existente que la transcripción contradice o dio de baja"]}',
  '',
  'Máximo 20 hechos nuevos. No repitas hechos existentes como nuevos: si un',
  'hecho ya está en la lista, referencialo por id en reinforcedFactIdList.',
].join('\n');

export function buildMemoryExtractionMessageList(input: {
  readonly transcriptText: string;
  readonly existingFactList: readonly OwnerFact[];
  readonly nowIso: string;
}): readonly OpenRouterChatMessage[] {
  const existingFactsText =
    input.existingFactList.length === 0
      ? '(ninguno todavía)'
      : input.existingFactList
          .map((fact) => `${fact.id}: [${fact.category}] ${fact.content}`)
          .join('\n');
  return [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Hechos existentes:\n${existingFactsText}\n\n` +
        `Transcripción reciente (consolidación del ${input.nowIso}):\n${input.transcriptText}`,
    },
  ];
}

export function buildExtractionRetryMessageList(
  previousMessageList: readonly OpenRouterChatMessage[],
  invalidResponseText: string,
): readonly OpenRouterChatMessage[] {
  return [
    ...previousMessageList,
    { role: 'assistant', content: invalidResponseText },
    {
      role: 'user',
      content:
        'Tu respuesta no fue JSON válido. Respondé únicamente el JSON pedido, sin ningún otro texto.',
    },
  ];
}

export function parseMemoryExtractionResult(
  rawText: string,
): MemoryExtractionResult | undefined {
  // Models wrap JSON in fences or prose despite instructions; the outermost
  // brace pair is the only part worth trying to parse.
  const withoutFences = rawText.replace(/```(?:json)?/gi, '');
  const firstBraceIndex = withoutFences.indexOf('{');
  const lastBraceIndex = withoutFences.lastIndexOf('}');
  if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
    return undefined;
  }
  try {
    const parsedResult = memoryExtractionResultSchema.safeParse(
      JSON.parse(withoutFences.slice(firstBraceIndex, lastBraceIndex + 1)),
    );
    return parsedResult.success ? parsedResult.data : undefined;
  } catch {
    return undefined;
  }
}

function normalizeFactContent(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\.+$/, '');
}

// The legacy memory block (and same-day remember_fact appends) hold facts that
// exist nowhere else in structured form; folding them in here both migrates
// the old block on first run and closes the race with a fact remembered after
// the transcript window was read.
export function seedOwnerFactsFromMemoryBlock(input: {
  readonly blockContent: string;
  readonly knownFactList: readonly OwnerFact[];
  readonly nowMilliseconds: number;
  readonly createIdentifier: () => string;
}): readonly OwnerFact[] {
  const knownContentSet = new Set(
    input.knownFactList.map((fact) => normalizeFactContent(fact.content)),
  );
  const seededFactList: OwnerFact[] = [...input.knownFactList];
  for (const blockLine of input.blockContent.split('\n')) {
    const trimmedLine = blockLine.trim();
    if (!trimmedLine.startsWith('- ')) {
      continue;
    }
    const factContent = trimmedLine.slice(2).trim();
    if (factContent.length === 0) {
      continue;
    }
    const normalizedContent = normalizeFactContent(factContent);
    if (knownContentSet.has(normalizedContent)) {
      continue;
    }
    knownContentSet.add(normalizedContent);
    seededFactList.push({
      id: input.createIdentifier(),
      content: factContent,
      category: 'fact',
      lastConfirmedAtMilliseconds: input.nowMilliseconds,
      sourceCount: 1,
    });
  }
  return seededFactList;
}

export type OwnerFactMergeResult = {
  readonly nextFactList: readonly OwnerFact[];
  readonly genuinelyNewFactList: readonly OwnerFact[];
};

export function mergeOwnerFacts(input: {
  readonly existingFactList: readonly OwnerFact[];
  readonly extraction: MemoryExtractionResult;
  readonly nowMilliseconds: number;
  readonly createIdentifier: () => string;
}): OwnerFactMergeResult {
  const reinforcedIdSet = new Set(input.extraction.reinforcedFactIdList);
  const staleIdSet = new Set(input.extraction.staleFactIdList);
  const decayCutoffMilliseconds =
    input.nowMilliseconds - OWNER_MEMORY_STALE_FACT_WINDOW_MS;

  const survivingFactList = input.existingFactList
    .filter((fact) => !staleIdSet.has(fact.id))
    .map((fact) =>
      reinforcedIdSet.has(fact.id)
        ? {
            ...fact,
            lastConfirmedAtMilliseconds: input.nowMilliseconds,
            sourceCount: fact.sourceCount + 1,
          }
        : fact,
    )
    .filter((fact) => fact.lastConfirmedAtMilliseconds >= decayCutoffMilliseconds);

  const knownContentSet = new Set(
    survivingFactList.map((fact) => normalizeFactContent(fact.content)),
  );
  const genuinelyNewFactList: OwnerFact[] = [];
  for (const extractedFact of input.extraction.newFactList) {
    const normalizedContent = normalizeFactContent(extractedFact.content);
    if (knownContentSet.has(normalizedContent)) {
      continue;
    }
    knownContentSet.add(normalizedContent);
    genuinelyNewFactList.push({
      id: input.createIdentifier(),
      content: extractedFact.content,
      category: extractedFact.category,
      lastConfirmedAtMilliseconds: input.nowMilliseconds,
      sourceCount: 1,
    });
  }

  const nextFactList = [...survivingFactList, ...genuinelyNewFactList]
    .toSorted((leftFact, rightFact) => {
      if (leftFact.sourceCount !== rightFact.sourceCount) {
        return rightFact.sourceCount - leftFact.sourceCount;
      }
      return rightFact.lastConfirmedAtMilliseconds - leftFact.lastConfirmedAtMilliseconds;
    })
    .slice(0, OWNER_MEMORY_MAX_FACT_COUNT);

  const keptIdSet = new Set(nextFactList.map((fact) => fact.id));
  return {
    nextFactList,
    genuinelyNewFactList: genuinelyNewFactList.filter((fact) => keptIdSet.has(fact.id)),
  };
}

const CATEGORY_HEADER_LIST: readonly {
  readonly category: OwnerFactCategory;
  readonly header: string;
}[] = [
  { category: 'preference', header: 'Preferencias' },
  { category: 'fact', header: 'Datos' },
  { category: 'context', header: 'Contexto actual' },
  { category: 'relationship', header: 'Relaciones' },
];

export function renderOwnerMemoryBlock(factList: readonly OwnerFact[]): string {
  const sectionList: string[] = [];
  for (const { category, header } of CATEGORY_HEADER_LIST) {
    const categoryFactList = factList.filter((fact) => fact.category === category);
    if (categoryFactList.length === 0) {
      continue;
    }
    sectionList.push(
      `${header}:\n${categoryFactList.map((fact) => `- ${fact.content}`).join('\n')}`,
    );
  }
  const renderedBlock = sectionList.join('\n\n');
  if (renderedBlock.length <= OWNER_MEMORY_BLOCK_MAX_CHARACTERS) {
    return renderedBlock;
  }
  // Truncate on a line boundary: a fact cut mid-sentence reads as nonsense in
  // the prompt.
  const lineList = renderedBlock.split('\n');
  const keptLineList: string[] = [];
  let renderedLength = 0;
  for (const line of lineList) {
    if (renderedLength + line.length + 1 > OWNER_MEMORY_BLOCK_MAX_CHARACTERS) {
      break;
    }
    keptLineList.push(line);
    renderedLength += line.length + 1;
  }
  return keptLineList.join('\n');
}

const memoryIndexIntentListSchema = z.array(
  z.object({
    memoryId: z.string().min(1),
    content: z.string().min(1),
  }),
);

export type MemoryIndexIntent = {
  readonly memoryId: string;
  readonly content: string;
};

export function parseStoredMemoryIndexIntentList(
  storedValue: string,
): readonly MemoryIndexIntent[] | undefined {
  try {
    const parsedList = memoryIndexIntentListSchema.safeParse(JSON.parse(storedValue));
    return parsedList.success ? parsedList.data : undefined;
  } catch {
    return undefined;
  }
}

export function parseStoredOwnerMemoryState(
  storedValue: string,
): OwnerMemoryState | undefined {
  try {
    const parsedState = ownerMemoryStateSchema.safeParse(JSON.parse(storedValue));
    return parsedState.success ? parsedState.data : undefined;
  } catch {
    return undefined;
  }
}
