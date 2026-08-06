import { z } from 'zod';

import { chatWithOpenRouter } from '@/voice/llm';

const researchQueryPlanSchema = z
  .array(z.string().min(1).max(200))
  .min(3)
  .max(5);

export function parseResearchQueryPlan(rawText: string): readonly string[] {
  const trimmedText = rawText.trim();
  const jsonArrayMatch = trimmedText.match(/\[[\s\S]*\]/);
  const candidateText = jsonArrayMatch?.[0] ?? trimmedText;
  return researchQueryPlanSchema.parse(JSON.parse(candidateText));
}

export async function planResearchQueryList(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly prompt: string;
}): Promise<readonly string[]> {
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: input.openRouterApiKey,
    modelId: input.modelId,
    messageList: [
      {
        role: 'system',
        content:
          'Devolvés SOLO un JSON array de 3 a 5 strings con queries de búsqueda web en español o inglés según convenga. Sin markdown.',
      },
      { role: 'user', content: input.prompt },
    ],
  });
  return parseResearchQueryPlan(chatResult.text);
}

export async function synthesizeQuickWebAnswer(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly query: string;
  readonly sourceList: readonly {
    readonly url: string;
    readonly title: string;
    readonly text: string;
  }[];
}): Promise<string> {
  const sourceBlock = input.sourceList
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.text}`,
    )
    .join('\n\n');
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: input.openRouterApiKey,
    modelId: input.modelId,
    messageList: [
      {
        role: 'system',
        content:
          'Respondé en español rioplatense, 2 a 4 oraciones, con hechos solo de las fuentes. Citá URLs al final. No inventes.',
      },
      {
        role: 'user',
        content: `Pregunta: ${input.query}\n\nFuentes:\n${sourceBlock}`,
      },
    ],
  });
  return chatResult.text.trim();
}

export async function synthesizeResearchReportMarkdown(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly prompt: string;
  readonly sourceList: readonly {
    readonly url: string;
    readonly title: string;
    readonly text: string;
  }[];
}): Promise<string> {
  const sourceBlock = input.sourceList
    .map(
      (source, index) =>
        `### Fuente ${index + 1}: ${source.title}\nURL: ${source.url}\n\n${source.text}`,
    )
    .join('\n\n');
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: input.openRouterApiKey,
    modelId: input.modelId,
    messageList: [
      {
        role: 'system',
        content:
          'Sos Apollo en modo deep research. Escribí un informe en markdown en español: resumen ejecutivo, hallazgos, matices/contradicciones, y sección Fuentes con links. Solo usá las fuentes dadas.',
      },
      {
        role: 'user',
        content: `Tema: ${input.prompt}\n\n${sourceBlock}`,
      },
    ],
  });
  return chatResult.text.trim();
}

export async function synthesizeResearchSpokenSummary(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly prompt: string;
  readonly reportMarkdown: string;
}): Promise<string> {
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: input.openRouterApiKey,
    modelId: input.modelId,
    messageList: [
      {
        role: 'system',
        content:
          'Resumí el informe en 2 a 4 oraciones para voz en español rioplatense. Cerrá diciendo que guardaste el informe completo.',
      },
      {
        role: 'user',
        content: `Pedido: ${input.prompt}\n\nInforme:\n${input.reportMarkdown.slice(0, 6000)}`,
      },
    ],
  });
  return chatResult.text.trim();
}
