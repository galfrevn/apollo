import { z } from 'zod';

// The agents SDK client protocol, as `useAgent` speaks it (verified against
// agents@0.20.1 dist/client.js): identity resolves the client's ready promise,
// cf_agent_state carries every state sync, and rpc is a flat request/response
// envelope correlated by id. Reconnection and timeouts live client-side.
const consoleRpcRequestSchema = z.object({
  type: z.literal('rpc'),
  id: z.string().min(1),
  method: z.string().min(1),
  args: z.array(z.unknown()),
});

export type ConsoleRpcRequest = z.infer<typeof consoleRpcRequestSchema>;

export type ParsedConsoleMessage =
  | { readonly kind: 'rpc'; readonly request: ConsoleRpcRequest }
  | { readonly kind: 'ignored' };

export function parseConsoleClientMessage(rawMessage: string): ParsedConsoleMessage {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawMessage);
  } catch {
    return { kind: 'ignored' };
  }
  const parsedRequest = consoleRpcRequestSchema.safeParse(parsedJson);
  if (parsedRequest.success) {
    return { kind: 'rpc', request: parsedRequest.data };
  }
  return { kind: 'ignored' };
}

export function encodeConsoleIdentityMessage(input: {
  readonly agentName: string;
  readonly instanceName: string;
}): string {
  return JSON.stringify({
    type: 'cf_agent_identity',
    agent: input.agentName,
    name: input.instanceName,
  });
}

export function encodeConsoleStateMessage(state: unknown): string {
  return JSON.stringify({ type: 'cf_agent_state', state });
}

export function encodeConsoleMcpServersMessage(): string {
  return JSON.stringify({
    type: 'cf_agent_mcp_servers',
    mcp: { servers: {}, tools: [], prompts: [], resources: [] },
  });
}

export function encodeConsoleRpcSuccess(requestId: string, result: unknown): string {
  return JSON.stringify({ type: 'rpc', id: requestId, success: true, result });
}

export function encodeConsoleRpcError(requestId: string, errorMessage: string): string {
  return JSON.stringify({
    type: 'rpc',
    id: requestId,
    success: false,
    error: errorMessage,
  });
}
