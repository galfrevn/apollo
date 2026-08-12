import {
  CONFIRM_TIMEOUT_MILLISECONDS,
  type PendingToolConfirmation,
  type ToolDefinition,
  type ToolExecutionContext,
  type ToolExecutionResult,
} from '@/tools/types';

export type ToolRouterOutcome =
  | { readonly status: 'done'; readonly result: ToolExecutionResult }
  | {
      readonly status: 'needs_confirm';
      readonly pending: PendingToolConfirmation;
    };

export function isPendingConfirmationExpired(
  pendingConfirmation: PendingToolConfirmation,
  nowMilliseconds: number,
): boolean {
  return nowMilliseconds >= pendingConfirmation.expiresAt;
}

export async function executeToolByName(
  toolDefinitionMap: ReadonlyMap<string, ToolDefinition>,
  toolName: string,
  toolArgs: unknown,
  context: ToolExecutionContext,
  createConfirmationId: () => string = () => crypto.randomUUID(),
): Promise<ToolRouterOutcome> {
  const toolDefinition = toolDefinitionMap.get(toolName);
  if (toolDefinition === undefined) {
    return {
      status: 'done',
      result: {
        ok: false,
        summary: `Herramienta desconocida: ${toolName}`,
      },
    };
  }

  if (toolDefinition.safety === 'unsafe') {
    // Building the summary is also the gate on the arguments: it parses them
    // with the tool's own schema, so no confirmation is ever created — or
    // persisted, or shown to the user — for a call that could not run. Letting
    // the parse failure escape would fail the whole turn; the model sending
    // arguments a tool cannot accept is an ordinary tool error it can retry.
    let summary: string;
    try {
      summary = toolDefinition.buildConfirmSummary?.(toolArgs) ?? `Confirmar ${toolName}`;
    } catch {
      return {
        status: 'done',
        result: {
          ok: false,
          summary: `No pude preparar la confirmación de ${toolName}: argumentos inválidos`,
        },
      };
    }
    return {
      status: 'needs_confirm',
      pending: {
        id: createConfirmationId(),
        toolName,
        args: toolArgs,
        summary,
        expiresAt: context.nowMilliseconds + CONFIRM_TIMEOUT_MILLISECONDS,
      },
    };
  }

  const result = await toolDefinition.handler(toolArgs, context);
  return { status: 'done', result };
}

export async function resolvePendingToolConfirmation(
  toolDefinitionMap: ReadonlyMap<string, ToolDefinition>,
  pendingConfirmation: PendingToolConfirmation,
  isApproved: boolean,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult | { readonly cancelled: true }> {
  if (isPendingConfirmationExpired(pendingConfirmation, context.nowMilliseconds)) {
    return { cancelled: true };
  }
  if (!isApproved) {
    return { cancelled: true };
  }
  const toolDefinition = toolDefinitionMap.get(pendingConfirmation.toolName);
  if (toolDefinition === undefined) {
    return {
      ok: false,
      summary: `Herramienta desconocida: ${pendingConfirmation.toolName}`,
    };
  }
  return toolDefinition.handler(pendingConfirmation.args, context);
}

export function buildToolDefinitionMap(
  toolDefinitionList: readonly ToolDefinition[],
): Map<string, ToolDefinition> {
  return new Map(
    toolDefinitionList.map((toolDefinition) => [toolDefinition.name, toolDefinition]),
  );
}
