import { chatWithOpenRouter } from '@/voice/llm';

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
