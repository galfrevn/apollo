import {
  buildInstalledMcpToolDefinitionList,
  parseDiscoveredMcpToolList,
  resolveDiscoveredMcpToolSafety,
  type DiscoveredMcpTool,
} from '@/mcp/adapter';
import {
  mcpCallToolResultSchema,
  summarizeMcpCallToolResult,
  type McpCallToolResult,
} from '@/mcp/result';
import {
  buildMcpServerSummaryList,
  mcpServerRecordSchema,
  type McpServerRecordCandidateMap,
  type McpServerSummary,
} from '@/mcp/servers';
import type { McpToolSettingRow } from '@/mcp/settings';
import { listBuiltinToolDefinitionList } from '@/tools/catalog';
import { buildToolDefinitionMap } from '@/tools/router';
import type { DeskToolEffects, ToolDefinition, ToolExecutionResult } from '@/tools/types';

// An unreachable server must cost less than the silence the owner would hear.
export const MCP_CONNECTION_WAIT_TIMEOUT_MILLISECONDS = 2000;

// Structural rather than the SDK's MCPClientManager, so these stay callable with
// a plain object and the agent class is not a prerequisite for testing them.
export type McpToolDiscoverySource = {
  readonly waitForConnections: (options: { timeout: number }) => Promise<void>;
  readonly listTools: () => readonly unknown[];
};

type InstalledMcpToolCallInput = Parameters<DeskToolEffects['callInstalledMcpTool']>[0];

export type McpToolCallSource = {
  readonly callTool: (params: {
    readonly serverId: string;
    readonly name: string;
    readonly arguments: InstalledMcpToolCallInput['argumentRecord'];
  }) => Promise<McpCallToolResult>;
};

// Waking from hibernation restores MCP connections asynchronously, so listTools()
// reads empty until they settle. The wait is bounded because a dead server must
// never hold a voice turn open.
export async function discoverInstalledMcpToolList(
  mcpClientManager: McpToolDiscoverySource,
): Promise<readonly DiscoveredMcpTool[]> {
  try {
    await mcpClientManager.waitForConnections({
      timeout: MCP_CONNECTION_WAIT_TIMEOUT_MILLISECONDS,
    });
    return parseDiscoveredMcpToolList(mcpClientManager.listTools());
  } catch (error) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'apollo_mcp_discovery_failed',
        error: error instanceof Error ? error.message : String(error),
      }),
    );
    return [];
  }
}

export function buildMcpServerLabelMap(
  serverRecordMap: McpServerRecordCandidateMap,
): ReadonlyMap<string, string> {
  return new Map(
    Object.entries(serverRecordMap).flatMap(([serverId, rawRecord]) => {
      const parsedRecord = mcpServerRecordSchema.safeParse(rawRecord);
      return parsedRecord.success ? [[serverId, parsedRecord.data.name] as const] : [];
    }),
  );
}

export function buildTurnToolDefinitionMap(input: {
  readonly discoveredToolList: readonly DiscoveredMcpTool[];
  readonly settingList: readonly McpToolSettingRow[];
  readonly serverRecordMap: McpServerRecordCandidateMap;
  readonly callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'];
}): ReadonlyMap<string, ToolDefinition> {
  const installedToolList = buildInstalledMcpToolDefinitionList({
    discoveredToolList: input.discoveredToolList,
    settingList: input.settingList,
    serverLabelMap: buildMcpServerLabelMap(input.serverRecordMap),
    callInstalledMcpTool: input.callInstalledMcpTool,
  });
  // Builtins last: the map keeps the final entry on a name collision, so an
  // installed server can never capture a name the persona prompt promises.
  return buildToolDefinitionMap([
    ...installedToolList,
    ...listBuiltinToolDefinitionList(),
  ]);
}

export function buildInstalledMcpServerSummaryList(input: {
  readonly serverRecordMap: McpServerRecordCandidateMap;
  readonly discoveredToolList: readonly DiscoveredMcpTool[];
  readonly settingList: readonly McpToolSettingRow[];
}): readonly McpServerSummary[] {
  return buildMcpServerSummaryList({
    serverRecordMap: input.serverRecordMap,
    discoveredToolList: input.discoveredToolList,
    settingList: input.settingList,
    defaultSafetyResolver: resolveDiscoveredMcpToolSafety,
  });
}

export async function callInstalledMcpTool(
  mcpClientManager: McpToolCallSource,
  input: InstalledMcpToolCallInput,
): Promise<ToolExecutionResult> {
  try {
    const callResult = await mcpClientManager.callTool({
      serverId: input.serverId,
      name: input.toolName,
      arguments: input.argumentRecord,
    });
    return summarizeMcpCallToolResult(
      mcpCallToolResultSchema.safeParse(callResult),
      'Hecho.',
      `El servidor rechazó ${input.toolName}.`,
    );
  } catch (error) {
    return {
      ok: false,
      summary: `No pude usar ${input.toolName}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}
