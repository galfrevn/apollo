import { describe, expect, it } from 'bun:test';

import { resolveDiscoveredMcpToolSafety, type DiscoveredMcpTool } from '@/mcp/adapter';
import {
  buildMcpServerSummaryList,
  installMcpServerInputSchema,
  setMcpToolEnabledInputSchema,
} from '@/mcp/servers';
import type { McpToolSettingRow } from '@/mcp/settings';

describe('install mcp server input', () => {
  it('accepts an absolute https url', () => {
    expect(
      installMcpServerInputSchema.safeParse({
        secret: 'dashboard-secret',
        name: 'GitHub',
        url: 'https://mcp.example.com/sse',
      }).success,
    ).toBe(true);
  });

  it('rejects a relative, http or malformed url', () => {
    for (const url of ['/mcp', 'http://mcp.example.com', 'mcp.example.com', '']) {
      expect(
        installMcpServerInputSchema.safeParse({
          secret: 'dashboard-secret',
          name: 'GitHub',
          url,
        }).success,
      ).toBe(false);
    }
  });

  it('requires a secret and a name', () => {
    expect(
      installMcpServerInputSchema.safeParse({
        name: 'GitHub',
        url: 'https://mcp.example.com',
      }).success,
    ).toBe(false);
    expect(
      installMcpServerInputSchema.safeParse({
        secret: 'dashboard-secret',
        name: '',
        url: 'https://mcp.example.com',
      }).success,
    ).toBe(false);
  });
});

describe('set mcp tool enabled input', () => {
  it('takes an optional safety override', () => {
    const parsedInput = setMcpToolEnabledInputSchema.safeParse({
      secret: 'dashboard-secret',
      serverId: 'github',
      toolName: 'list_issues',
      safety: 'safe',
    });
    expect(parsedInput.success).toBe(true);
    expect(
      setMcpToolEnabledInputSchema.safeParse({
        secret: 'dashboard-secret',
        serverId: 'github',
        toolName: 'list_issues',
        safety: 'whatever',
      }).success,
    ).toBe(false);
  });
});

describe('mcp server summary', () => {
  const discoveredToolList: readonly DiscoveredMcpTool[] = [
    {
      serverId: 'github',
      name: 'list_issues',
      description: 'List issues',
      annotations: { readOnlyHint: true },
    },
    { serverId: 'github', name: 'create_issue', description: 'Create an issue' },
    { serverId: 'linear', name: 'list_teams', description: 'List teams' },
  ];

  const settingList: readonly McpToolSettingRow[] = [
    {
      namespacedName: 'mcp_github_list_issues',
      serverId: 'github',
      toolName: 'list_issues',
      isEnabled: true,
      safety: 'safe',
    },
  ];

  it('groups discovered tools under their own server', () => {
    const summaryList = buildMcpServerSummaryList({
      serverRecordMap: {
        github: {
          name: 'GitHub',
          server_url: 'https://mcp.github.example',
          state: 'ready',
          auth_url: null,
          error: null,
        },
        linear: {
          name: 'Linear',
          server_url: 'https://mcp.linear.example',
          state: 'authenticating',
          auth_url: 'https://mcp.linear.example/oauth',
          error: null,
        },
      },
      discoveredToolList,
      settingList,
      defaultSafetyResolver: resolveDiscoveredMcpToolSafety,
    });

    expect(summaryList).toHaveLength(2);
    const githubSummary = summaryList.find((summary) => summary.serverId === 'github');
    expect(githubSummary?.toolList).toHaveLength(2);
    expect(githubSummary?.authUrl).toBeNull();

    const linearSummary = summaryList.find((summary) => summary.serverId === 'linear');
    expect(linearSummary?.authUrl).toBe('https://mcp.linear.example/oauth');
    expect(linearSummary?.toolList).toHaveLength(1);
  });

  it('reports a tool with no setting row as disabled at its default safety', () => {
    const [summary] = buildMcpServerSummaryList({
      serverRecordMap: {
        github: {
          name: 'GitHub',
          server_url: 'https://mcp.github.example',
          state: 'ready',
        },
      },
      discoveredToolList,
      settingList,
      defaultSafetyResolver: resolveDiscoveredMcpToolSafety,
    });

    const createIssue = summary?.toolList.find(
      (tool) => tool.toolName === 'create_issue',
    );
    expect(createIssue).toMatchObject({ isEnabled: false, safety: 'unsafe' });

    const listIssues = summary?.toolList.find((tool) => tool.toolName === 'list_issues');
    expect(listIssues).toMatchObject({ isEnabled: true, safety: 'safe' });
  });

  it('drops a server record it cannot read back', () => {
    const summaryList = buildMcpServerSummaryList({
      serverRecordMap: { broken: { name: 'Broken' }, missing: null },
      discoveredToolList: [],
      settingList: [],
      defaultSafetyResolver: resolveDiscoveredMcpToolSafety,
    });
    expect(summaryList).toEqual([]);
  });
});
