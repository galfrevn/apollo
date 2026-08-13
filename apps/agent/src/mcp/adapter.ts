import { z } from 'zod';

import { buildNamespacedMcpToolName } from '@/mcp/naming';
import { findMcpToolSetting, type McpToolSettingRow } from '@/mcp/settings';
import {
  jsonSerializableValueSchema,
  type DeskToolEffects,
  type JsonSerializableValue,
  type ToolArgumentRecord,
  type ToolDefinition,
  type ToolSafetyLevel,
} from '@/tools/types';

// Descriptions are authored by the installed server and land in the system
// prompt verbatim.
export const MCP_TOOL_DESCRIPTION_MAX_LENGTH = 400;

const MCP_CONFIRM_SUMMARY_ARGUMENT_MAX_LENGTH = 160;

const EMPTY_MCP_TOOL_PARAMETERS = {
  type: 'object',
  properties: {},
};

// Every caller hands this schema a value that is already statically
// JsonSerializableValue, so only the record shape needs checking at runtime;
// recursing into values would blow the stack on the self-referencing records
// the JSON.stringify guard below exists to survive.
const mcpToolArgumentRecordSchema: z.ZodType<ToolArgumentRecord> = z.record(
  z.custom<JsonSerializableValue>(() => true),
);

export const discoveredMcpToolSchema = z.object({
  serverId: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.record(jsonSerializableValueSchema).optional(),
  annotations: z
    .object({
      readOnlyHint: z.boolean().optional(),
      destructiveHint: z.boolean().optional(),
    })
    .optional(),
});

export type DiscoveredMcpTool = z.infer<typeof discoveredMcpToolSchema>;

export function parseDiscoveredMcpToolList(
  rawToolList: readonly unknown[],
): readonly DiscoveredMcpTool[] {
  return rawToolList.flatMap((rawTool) => {
    const parsedTool = discoveredMcpToolSchema.safeParse(rawTool);
    return parsedTool.success ? [parsedTool.data] : [];
  });
}

// Installed servers are unreviewed code reachable by voice, so confirmation is
// the default and only the server's own read-only claim opts out of it.
export function resolveDiscoveredMcpToolSafety(
  discoveredTool: DiscoveredMcpTool,
): ToolSafetyLevel {
  if (discoveredTool.annotations?.destructiveHint === true) {
    return 'unsafe';
  }
  return discoveredTool.annotations?.readOnlyHint === true ? 'safe' : 'unsafe';
}

export function truncateMcpText(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function buildInstalledMcpToolDescription(
  discoveredTool: DiscoveredMcpTool,
  serverLabel: string,
): string {
  const serverDescription =
    discoveredTool.description === undefined || discoveredTool.description === ''
      ? discoveredTool.name
      : discoveredTool.description;
  return truncateMcpText(
    `[${serverLabel}] ${serverDescription}`,
    MCP_TOOL_DESCRIPTION_MAX_LENGTH,
  );
}

function buildInstalledMcpToolDefinition(input: {
  readonly discoveredTool: DiscoveredMcpTool;
  readonly namespacedName: string;
  readonly safety: ToolSafetyLevel;
  readonly serverLabel: string;
  readonly callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'];
}): ToolDefinition {
  const { discoveredTool, namespacedName, safety, serverLabel } = input;
  return {
    name: namespacedName,
    safety,
    description: buildInstalledMcpToolDescription(discoveredTool, serverLabel),
    parameters: discoveredTool.inputSchema ?? EMPTY_MCP_TOOL_PARAMETERS,
    // The router reads a throw here as arguments the tool cannot accept, and an
    // installed server owns its own schema, so this renders without validating.
    buildConfirmSummary(toolArgs) {
      const parsedArgumentRecord = mcpToolArgumentRecordSchema.safeParse(toolArgs);
      let renderedArguments: string;
      try {
        renderedArguments =
          JSON.stringify(parsedArgumentRecord.success ? parsedArgumentRecord.data : {}) ??
          '{}';
      } catch {
        renderedArguments = '{}';
      }
      return `${serverLabel}: ${discoveredTool.name} ${truncateMcpText(
        renderedArguments,
        MCP_CONFIRM_SUMMARY_ARGUMENT_MAX_LENGTH,
      )}`.trim();
    },
    // executeToolByName does not wrap safe handlers, so an escaping network
    // error would fail the whole turn instead of this one call.
    async handler(toolArgs) {
      const parsedArgumentRecord = mcpToolArgumentRecordSchema.safeParse(toolArgs);
      try {
        return await input.callInstalledMcpTool({
          serverId: discoveredTool.serverId,
          toolName: discoveredTool.name,
          argumentRecord: parsedArgumentRecord.success ? parsedArgumentRecord.data : {},
        });
      } catch (error) {
        return {
          ok: false,
          summary: `Falló ${discoveredTool.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        };
      }
    },
  };
}

// Two enabled tools rendering to one name would let the map's last writer answer
// for both. Dropping every side of a collision fails closed; keeping one would
// run it under a safety level the owner granted to a different tool.
export function listNonCollidingMcpToolDefinitions(
  toolDefinitionList: readonly ToolDefinition[],
): readonly ToolDefinition[] {
  const nameCountMap = new Map<string, number>();
  for (const toolDefinition of toolDefinitionList) {
    nameCountMap.set(
      toolDefinition.name,
      (nameCountMap.get(toolDefinition.name) ?? 0) + 1,
    );
  }
  return toolDefinitionList.filter(
    (toolDefinition) => nameCountMap.get(toolDefinition.name) === 1,
  );
}

export function buildInstalledMcpToolDefinitionList(input: {
  readonly discoveredToolList: readonly DiscoveredMcpTool[];
  readonly settingList: readonly McpToolSettingRow[];
  readonly serverLabelMap: ReadonlyMap<string, string>;
  readonly callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'];
}): readonly ToolDefinition[] {
  const enabledToolDefinitionList = input.discoveredToolList.flatMap((discoveredTool) => {
    const namespacedName = buildNamespacedMcpToolName(
      discoveredTool.serverId,
      discoveredTool.name,
    );
    const settingRow = findMcpToolSetting(
      input.settingList,
      discoveredTool.serverId,
      discoveredTool.name,
    );
    if (settingRow === undefined || !settingRow.isEnabled) {
      return [];
    }
    return [
      buildInstalledMcpToolDefinition({
        discoveredTool,
        namespacedName,
        safety: settingRow.safety,
        serverLabel:
          input.serverLabelMap.get(discoveredTool.serverId) ?? discoveredTool.serverId,
        callInstalledMcpTool: input.callInstalledMcpTool,
      }),
    ];
  });
  return listNonCollidingMcpToolDefinitions(enabledToolDefinitionList);
}
