import { z } from 'zod';

import type { ToolExecutionResult } from '@/tools/types';

export const mcpCallToolResultSchema = z.object({
  content: z
    .array(z.object({ type: z.string(), text: z.string().optional() }))
    .optional(),
  isError: z.boolean().optional(),
});

export type McpCallToolResult = z.infer<typeof mcpCallToolResultSchema>;

export type McpCallToolResultParseOutcome = ReturnType<
  typeof mcpCallToolResultSchema.safeParse
>;

export function readMcpCallToolResultText(parsedResult: McpCallToolResult): string {
  return (parsedResult.content ?? [])
    .flatMap((contentEntry) =>
      contentEntry.text === undefined ? [] : [contentEntry.text],
    )
    .join('\n');
}

export function summarizeMcpCallToolResult(
  parseOutcome: McpCallToolResultParseOutcome,
  fallbackSummary: string,
  errorSummary: string,
): ToolExecutionResult {
  if (!parseOutcome.success) {
    return { ok: true, summary: fallbackSummary };
  }
  const textContent = readMcpCallToolResultText(parseOutcome.data);
  if (parseOutcome.data.isError === true) {
    return {
      ok: false,
      summary: textContent === '' ? errorSummary : textContent,
    };
  }
  return { ok: true, summary: textContent === '' ? fallbackSummary : textContent };
}
