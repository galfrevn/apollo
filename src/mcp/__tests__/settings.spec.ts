import { describe, expect, it } from 'bun:test';

import { createInMemoryMcpToolSettingsSqlExecutor } from '@/configuration/testing';
import {
  deleteMcpToolSettingsForServer,
  findMcpToolSetting,
  listMcpToolSettings,
  saveMcpToolSetting,
  type McpToolSettingRow,
} from '@/mcp/settings';

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

describe('mcp tool settings', () => {
  it('round-trips a saved row', async () => {
    const sqlExecutor = createInMemoryMcpToolSettingsSqlExecutor();
    await saveMcpToolSetting(sqlExecutor, buildSettingRow());
    await expect(listMcpToolSettings(sqlExecutor)).resolves.toEqual([buildSettingRow()]);
  });

  it('replaces a row instead of duplicating it', async () => {
    const sqlExecutor = createInMemoryMcpToolSettingsSqlExecutor();
    await saveMcpToolSetting(sqlExecutor, buildSettingRow({ isEnabled: true }));
    await saveMcpToolSetting(
      sqlExecutor,
      buildSettingRow({ isEnabled: false, safety: 'unsafe' }),
    );
    const settingList = await listMcpToolSettings(sqlExecutor);
    expect(settingList).toHaveLength(1);
    expect(settingList[0]).toMatchObject({ isEnabled: false, safety: 'unsafe' });
  });

  it('deletes only the rows of the removed server', async () => {
    const sqlExecutor = createInMemoryMcpToolSettingsSqlExecutor();
    await saveMcpToolSetting(sqlExecutor, buildSettingRow());
    await saveMcpToolSetting(
      sqlExecutor,
      buildSettingRow({
        namespacedName: 'mcp_linear_list_issues',
        serverId: 'linear',
      }),
    );
    await deleteMcpToolSettingsForServer(sqlExecutor, 'github');
    const settingList = await listMcpToolSettings(sqlExecutor);
    expect(settingList).toHaveLength(1);
    expect(settingList[0]?.serverId).toBe('linear');
  });

  it('skips a row that cannot be read back instead of surfacing it raw', async () => {
    const sqlExecutor = createInMemoryMcpToolSettingsSqlExecutor([
      {
        namespaced_name: 'mcp_broken_tool',
        server_id: 'broken',
        tool_name: 'tool',
        is_enabled: 1,
        safety: 'whatever',
      },
      {
        namespaced_name: 'mcp_github_list_issues',
        server_id: 'github',
        tool_name: 'list_issues',
        is_enabled: 1,
        safety: 'safe',
      },
    ]);
    const settingList = await listMcpToolSettings(sqlExecutor);
    expect(settingList).toHaveLength(1);
    expect(settingList[0]?.serverId).toBe('github');
  });

  it('finds a row by its raw server and tool identity', () => {
    const settingList = [buildSettingRow()];
    expect(findMcpToolSetting(settingList, 'github', 'list_issues')).toBeDefined();
    expect(findMcpToolSetting(settingList, 'github', 'other')).toBeUndefined();
    expect(findMcpToolSetting(settingList, 'linear', 'list_issues')).toBeUndefined();
  });

  it('does not match a tool whose name merely sanitizes alike', () => {
    const settingList = [buildSettingRow({ toolName: 'read-only' })];
    expect(findMcpToolSetting(settingList, 'github', 'read-only')).toBeDefined();
    expect(findMcpToolSetting(settingList, 'github', 'read_only')).toBeUndefined();
  });
});
