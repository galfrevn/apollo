export type SandboxCodeLanguage = 'python' | 'javascript' | 'typescript';

export const MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS = 4000;

export function truncateSandboxOutputForToolResult(outputText: string): string {
  if (outputText.length <= MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS) {
    return outputText;
  }
  return `${outputText.slice(0, MAX_SANDBOX_TOOL_RESULT_OUTPUT_CHARACTERS)}\n… (truncado)`;
}

export function buildApolloSandboxId(deviceId: string): string {
  const normalizedDeviceId = deviceId.trim().toLowerCase() || 'default';
  return `apollo-${normalizedDeviceId}`;
}

export function formatSandboxCodeSummary(input: {
  readonly language: SandboxCodeLanguage;
  readonly stdout: string;
  readonly stderr: string;
  readonly errorName?: string;
  readonly errorValue?: string;
}): string {
  if (input.errorName !== undefined) {
    return `Sandbox ${input.language} error: ${input.errorName}: ${input.errorValue ?? ''}`.trim();
  }
  const outputText = input.stdout.trim();
  if (outputText.length > 0) {
    return outputText.slice(0, 1200);
  }
  if (input.stderr.trim().length > 0) {
    return input.stderr.trim().slice(0, 1200);
  }
  return `Sandbox ${input.language}: sin salida`;
}
