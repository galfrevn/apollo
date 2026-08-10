import { formatCurrentDateTimeForPrompt } from '@/persona/clock';
import { chatWithOpenRouter } from '@/voice/llm';

// Deep research runs on Perplexity Sonar via OpenRouter: the model plans and
// executes its own multi-source web searches and returns a cited report in one
// call, replacing the old plan-queries → fetch-pages → synthesize pipeline
// (which sat on the now-disabled Cloudflare Web Search binding).
export async function runDeepResearchWithPerplexity(input: {
  readonly openRouterApiKey: string;
  readonly modelId: string;
  readonly prompt: string;
  readonly nowMilliseconds: number;
  readonly fetchImplementation?: typeof fetch;
}): Promise<string> {
  const chatResult = await chatWithOpenRouter({
    openRouterApiKey: input.openRouterApiKey,
    modelId: input.modelId,
    messageList: [
      {
        role: 'system',
        content:
          `Sos Apollo en modo deep research. Hoy es ${formatCurrentDateTimeForPrompt(input.nowMilliseconds)}. ` +
          'Investigá a fondo en la web priorizando información vigente y escribí un informe en markdown en español: resumen ejecutivo, hallazgos, matices/contradicciones, y sección Fuentes con links. Citá las fuentes y aclará la fecha de los datos cuando importe.',
      },
      { role: 'user', content: input.prompt },
    ],
    ...(input.fetchImplementation !== undefined
      ? { fetchImplementation: input.fetchImplementation }
      : {}),
  });
  return chatResult.text.trim();
}
