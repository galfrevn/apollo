import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { buildNamespacedMcpToolName } from '@/mcp/naming';
import {
  buildInstalledMcpToolDefinitionList,
  listNonCollidingMcpToolDefinitions,
  MCP_TOOL_DESCRIPTION_MAX_LENGTH,
  parseDiscoveredMcpToolList,
  resolveDiscoveredMcpToolSafety,
  type DiscoveredMcpTool,
} from '@/mcp/adapter';
import type { McpToolSettingRow } from '@/mcp/settings';
import type { DeskToolEffects, ToolDefinition } from '@/tools/types';

const githubIssueInputSchema = {
  type: 'object',
  properties: { repository: { type: 'string' } },
  required: ['repository'],
  additionalProperties: false,
};

function buildDiscoveredTool(
  overrides: Partial<DiscoveredMcpTool> = {},
): DiscoveredMcpTool {
  return {
    serverId: 'github',
    name: 'list_issues',
    description: 'List the open issues of a repository',
    inputSchema: githubIssueInputSchema,
    ...overrides,
  };
}

function buildSettingRow(overrides: Partial<McpToolSettingRow> = {}): McpToolSettingRow {
  return {
    namespacedName: 'mcp_github_list_issues',
    serverId: 'github',
    toolName: 'list_issues',
    isEnabled: true,
    safety: 'safe',
    ...overrides,
  };
}

const rejectingMcpEffect: DeskToolEffects['callInstalledMcpTool'] = async () => {
  throw new Error('socket hang up');
};

function buildRecordingEffect(
  result: Awaited<ReturnType<DeskToolEffects['callInstalledMcpTool']>> = {
    ok: true,
    summary: 'done',
  },
) {
  const callList: Parameters<DeskToolEffects['callInstalledMcpTool']>[0][] = [];
  const callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'] = async (call) => {
    callList.push(call);
    return result;
  };
  return { callInstalledMcpTool, readCallList: () => callList };
}

function buildDefinitionList(input: {
  readonly discoveredToolList: readonly DiscoveredMcpTool[];
  readonly settingList: readonly McpToolSettingRow[];
  readonly callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'];
}): readonly ToolDefinition[] {
  return buildInstalledMcpToolDefinitionList({
    ...input,
    serverLabelMap: new Map([['github', 'GitHub']]),
  });
}

describe('discovered mcp tool parsing', () => {
  it('drops entries that do not describe a tool', () => {
    const parsedList = parseDiscoveredMcpToolList([
      buildDiscoveredTool(),
      { serverId: 'github' },
      null,
      { name: 'orphan' },
    ]);
    expect(parsedList).toHaveLength(1);
    expect(parsedList[0]?.name).toBe('list_issues');
  });
});

describe('discovered mcp tool safety', () => {
  it('gates a tool the server says nothing about', () => {
    expect(resolveDiscoveredMcpToolSafety(buildDiscoveredTool())).toBe('unsafe');
  });

  it('allows a tool the server marks read-only', () => {
    expect(
      resolveDiscoveredMcpToolSafety(
        buildDiscoveredTool({ annotations: { readOnlyHint: true } }),
      ),
    ).toBe('safe');
  });

  it('gates a destructive tool even when it claims to be read-only', () => {
    expect(
      resolveDiscoveredMcpToolSafety(
        buildDiscoveredTool({
          annotations: { readOnlyHint: true, destructiveHint: true },
        }),
      ),
    ).toBe('unsafe');
  });
});

function buildNamedDefinition(name: string): ToolDefinition {
  return {
    name,
    safety: 'safe',
    description: name,
    parameters: {},
    handler: async () => ({ ok: true, summary: name }),
  };
}

describe('mcp tool name collision guard', () => {
  it('drops every side of a collision rather than letting the last one win', () => {
    const survivingList = listNonCollidingMcpToolDefinitions([
      buildNamedDefinition('mcp_shared'),
      buildNamedDefinition('mcp_shared'),
      buildNamedDefinition('mcp_unique'),
    ]);
    expect(survivingList.map((definition) => definition.name)).toEqual(['mcp_unique']);
  });

  it('keeps a list that has no collisions untouched', () => {
    const definitionList = [
      buildNamedDefinition('mcp_one'),
      buildNamedDefinition('mcp_two'),
    ];
    expect(listNonCollidingMcpToolDefinitions(definitionList)).toEqual(definitionList);
  });
});

describe('installed mcp tool definitions', () => {
  it('omits a tool with no setting row', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    expect(
      buildDefinitionList({
        discoveredToolList: [buildDiscoveredTool()],
        settingList: [],
        callInstalledMcpTool,
      }),
    ).toEqual([]);
  });

  it('omits a disabled tool so it is neither offered nor callable', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    expect(
      buildDefinitionList({
        discoveredToolList: [buildDiscoveredTool()],
        settingList: [buildSettingRow({ isEnabled: false })],
        callInstalledMcpTool,
      }),
    ).toEqual([]);
  });

  it('passes the mcp input schema through untouched', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool()],
      settingList: [buildSettingRow()],
      callInstalledMcpTool,
    });
    expect(definition?.parameters).toBe(githubIssueInputSchema);
    expect(definition?.name).toBe(buildNamespacedMcpToolName('github', 'list_issues'));
    expect(definition?.safety).toBe('safe');
  });

  it('falls back to an empty object schema when the server sends none', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool({ inputSchema: undefined })],
      settingList: [buildSettingRow()],
      callInstalledMcpTool,
    });
    expect(definition?.parameters).toEqual({ type: 'object', properties: {} });
  });

  it('caps a description long enough to crowd the system prompt', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool({ description: 'x'.repeat(5000) })],
      settingList: [buildSettingRow()],
      callInstalledMcpTool,
    });
    expect(definition?.description.length).toBe(MCP_TOOL_DESCRIPTION_MAX_LENGTH);
  });

  it('routes a call to the server and tool it was discovered from', async () => {
    const { callInstalledMcpTool, readCallList } = buildRecordingEffect();
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool()],
      settingList: [buildSettingRow()],
      callInstalledMcpTool,
    });
    const result = await definition?.handler(
      { repository: 'galfrevn/apollo' },
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 0 },
    );
    expect(readCallList()).toEqual([
      {
        serverId: 'github',
        toolName: 'list_issues',
        argumentRecord: { repository: 'galfrevn/apollo' },
      },
    ]);
    expect(result).toEqual({ ok: true, summary: 'done' });
  });

  it('resolves to a tool failure when the mcp call rejects', async () => {
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool()],
      settingList: [buildSettingRow()],
      callInstalledMcpTool: rejectingMcpEffect,
    });
    const result = await definition?.handler(
      {},
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 0 },
    );
    expect(result?.ok).toBe(false);
    expect(result?.summary).toContain('socket hang up');
  });

  it('never lends one tool the approval the owner granted to another', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    const definitionList = buildDefinitionList({
      discoveredToolList: [
        buildDiscoveredTool({ name: 'read-only', annotations: { readOnlyHint: true } }),
        buildDiscoveredTool({ name: 'read_only' }),
      ],
      settingList: [
        buildSettingRow({
          namespacedName: buildNamespacedMcpToolName('github', 'read-only'),
          toolName: 'read-only',
          isEnabled: true,
          safety: 'safe',
        }),
      ],
      callInstalledMcpTool,
    });

    expect(definitionList).toHaveLength(1);
    expect(definitionList[0]?.safety).toBe('safe');
    expect(definitionList[0]?.name).toBe(
      buildNamespacedMcpToolName('github', 'read-only'),
    );
  });

  it('builds a confirm summary that never throws on hostile arguments', () => {
    const { callInstalledMcpTool } = buildRecordingEffect();
    const [definition] = buildDefinitionList({
      discoveredToolList: [buildDiscoveredTool()],
      settingList: [buildSettingRow({ safety: 'unsafe' })],
      callInstalledMcpTool,
    });
    type SelfReferencingArgumentRecord = {
      self?: SelfReferencingArgumentRecord;
    };
    const circularArguments: SelfReferencingArgumentRecord = {};
    circularArguments.self = circularArguments;
    expect(() => definition?.buildConfirmSummary?.(circularArguments)).not.toThrow();
    expect(() => definition?.buildConfirmSummary?.(undefined)).not.toThrow();
    expect(() => definition?.buildConfirmSummary?.('not an object')).not.toThrow();
    expect(definition?.buildConfirmSummary?.({ repository: 'apollo' })).toContain(
      'GitHub: list_issues',
    );
  });
});
