import { z } from 'zod';

import type { ToolExecutionResult } from '@/tools/types';

export const mcpCallToolResultSchema = z.object({
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .optional(),
  isError: z.boolean().optional(),
});

export type McpCallToolResult = z.infer<typeof mcpCallToolResultSchema>;

export function readMcpCallToolResultText(parsedResult: McpCallToolResult): string {
  return (parsedResult.content ?? [])
    .map((contentEntry) => contentEntry.text)
    .filter((text): text is string => typeof text === 'string')
    .join('\n');
}

export function summarizeMcpCallToolResult(
  rawResult: unknown,
  fallbackSummary: string,
  errorSummary: string,
): ToolExecutionResult {
  const parsedResult = mcpCallToolResultSchema.safeParse(rawResult);
  if (!parsedResult.success) {
    return { ok: true, summary: fallbackSummary };
  }
  const textContent = readMcpCallToolResultText(parsedResult.data);
  if (parsedResult.data.isError === true) {
    return {
      ok: false,
      summary: textContent === '' ? errorSummary : textContent,
    };
  }
  return { ok: true, summary: textContent === '' ? fallbackSummary : textContent };
}
