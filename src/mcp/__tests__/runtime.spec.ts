import { describe, expect, it } from 'bun:test';

import { buildNamespacedMcpToolName } from '@/mcp/naming';
import {
  buildInstalledMcpServerSummaryList,
  buildMcpServerLabelMap,
  buildTurnToolDefinitionMap,
  callInstalledMcpTool,
  discoverInstalledMcpToolList,
  type McpToolCallSource,
  type McpToolDiscoverySource,
} from '@/mcp/runtime';
import type { McpToolSettingRow } from '@/mcp/settings';
import { listBuiltinToolDefinitionList } from '@/tools/catalog';
import type { DeskToolEffects } from '@/tools/types';

const stubMcpEffect: DeskToolEffects['callInstalledMcpTool'] = async () => ({
  ok: true,
  summary: 'done',
});

const githubServerRecordMap: Record<string, unknown> = {
  github: {
    name: 'GitHub',
    server_url: 'https://mcp.github.example',
    state: 'ready',
  },
};

const enabledListIssuesSetting: McpToolSettingRow = {
  namespacedName: 'mcp_github_list_issues',
  serverId: 'github',
  toolName: 'list_issues',
  isEnabled: true,
  safety: 'safe',
};

function buildDiscoverySource(
  overrides: Partial<McpToolDiscoverySource> = {},
): McpToolDiscoverySource {
  return {
    waitForConnections: async () => {},
    listTools: () => [
      { serverId: 'github', name: 'list_issues', description: 'List issues' },
    ],
    ...overrides,
  };
}

describe('installed mcp tool discovery', () => {
  it('parses the tools of connected servers', async () => {
    await expect(discoverInstalledMcpToolList(buildDiscoverySource())).resolves.toEqual([
      { serverId: 'github', name: 'list_issues', description: 'List issues' },
    ]);
  });

  it('degrades to no tools when waiting for connections fails', async () => {
    const failingSource = buildDiscoverySource({
      waitForConnections: async () => {
        throw new Error('durable object hibernated');
      },
    });
    await expect(discoverInstalledMcpToolList(failingSource)).resolves.toEqual([]);
  });

  it('degrades to no tools when listing throws', async () => {
    const failingSource = buildDiscoverySource({
      listTools: () => {
        throw new Error('transport closed');
      },
    });
    await expect(discoverInstalledMcpToolList(failingSource)).resolves.toEqual([]);
  });
});

describe('mcp server label map', () => {
  it('maps a server id to its display name and skips unreadable records', () => {
    const labelMap = buildMcpServerLabelMap({
      ...githubServerRecordMap,
      broken: { name: 'Broken' },
    });
    expect(labelMap.get('github')).toBe('GitHub');
    expect(labelMap.has('broken')).toBe(false);
  });
});

describe('turn tool definition map', () => {
  it('keeps every builtin alongside the enabled installed tools', () => {
    const toolDefinitionMap = buildTurnToolDefinitionMap({
      discoveredToolList: [
        { serverId: 'github', name: 'list_issues' },
        { serverId: 'github', name: 'create_issue' },
      ],
      settingList: [enabledListIssuesSetting],
      serverRecordMap: githubServerRecordMap,
      callInstalledMcpTool: stubMcpEffect,
    });

    expect(toolDefinitionMap.has('mcp_github_list_issues')).toBe(true);
    expect(toolDefinitionMap.has('mcp_github_create_issue')).toBe(false);
    expect(toolDefinitionMap.has('web_search')).toBe(true);
    expect(toolDefinitionMap.get('mcp_github_list_issues')?.description).toContain(
      'GitHub',
    );
  });

  it('keeps every builtin definition reachable under its own name', () => {
    const builtinNameList = listBuiltinToolDefinitionList().map(
      (toolDefinition) => toolDefinition.name,
    );
    const toolDefinitionMap = buildTurnToolDefinitionMap({
      discoveredToolList: [{ serverId: 'github', name: 'list_issues' }],
      settingList: [enabledListIssuesSetting],
      serverRecordMap: githubServerRecordMap,
      callInstalledMcpTool: stubMcpEffect,
    });
    for (const builtinName of builtinNameList) {
      expect(toolDefinitionMap.get(builtinName)?.name).toBe(builtinName);
    }
    expect(toolDefinitionMap.size).toBe(builtinNameList.length + 1);
  });

  it('namespaces every installed tool out of the builtin namespace', () => {
    const builtinNameSet = new Set(
      listBuiltinToolDefinitionList().map((toolDefinition) => toolDefinition.name),
    );
    const namespacedName = buildNamespacedMcpToolName('anything', 'web_search');
    expect(builtinNameSet.has(namespacedName)).toBe(false);
    expect(namespacedName).toStartWith('mcp_');
  });
});

describe('installed mcp server summary list', () => {
  it('reports the discovered tools of each server', () => {
    const summaryList = buildInstalledMcpServerSummaryList({
      serverRecordMap: githubServerRecordMap,
      discoveredToolList: [{ serverId: 'github', name: 'list_issues' }],
      settingList: [enabledListIssuesSetting],
    });
    expect(summaryList).toHaveLength(1);
    expect(summaryList[0]?.toolList[0]).toMatchObject({
      toolName: 'list_issues',
      isEnabled: true,
    });
  });
});

describe('installed mcp tool call', () => {
  it('forwards the namespaced call to the server and summarizes the result', async () => {
    const callList: unknown[] = [];
    const callSource: McpToolCallSource = {
      callTool: async (params) => {
        callList.push(params);
        return { content: [{ type: 'text', text: 'two issues' }] };
      },
    };
    await expect(
      callInstalledMcpTool(callSource, {
        serverId: 'github',
        toolName: 'list_issues',
        argumentRecord: { repository: 'apollo' },
      }),
    ).resolves.toEqual({ ok: true, summary: 'two issues' });
    expect(callList).toEqual([
      {
        serverId: 'github',
        name: 'list_issues',
        arguments: { repository: 'apollo' },
      },
    ]);
  });

  it('reports a rejected call as a tool failure rather than throwing', async () => {
    const failingSource: McpToolCallSource = {
      callTool: async () => {
        throw new Error('socket hang up');
      },
    };
    const result = await callInstalledMcpTool(failingSource, {
      serverId: 'github',
      toolName: 'list_issues',
      argumentRecord: {},
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('socket hang up');
  });

  it('reports an isError result as a failure', async () => {
    const erroringSource: McpToolCallSource = {
      callTool: async () => ({ content: [], isError: true }),
    };
    const result = await callInstalledMcpTool(erroringSource, {
      serverId: 'github',
      toolName: 'list_issues',
      argumentRecord: {},
    });
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('list_issues');
  });
});
