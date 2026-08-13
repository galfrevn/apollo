import { z } from 'zod';

import type { MemorySqlExecutor } from '@/memory/store';
import type { ToolSafetyLevel } from '@/tools/types';

export type McpToolSettingRow = {
  readonly namespacedName: string;
  readonly serverId: string;
  readonly toolName: string;
  readonly isEnabled: boolean;
  readonly safety: ToolSafetyLevel;
};

const mcpToolSettingSqlRowSchema = z.object({
  namespaced_name: z.string().min(1),
  server_id: z.string().min(1),
  tool_name: z.string().min(1),
  is_enabled: z.number().int(),
  safety: z.enum(['safe', 'unsafe']),
});

// Stored rows can predate the current schema, so any column may be missing or
// corrupt until the schema re-validates each row.
type McpToolSettingSqlRowCandidate = Partial<z.input<typeof mcpToolSettingSqlRowSchema>>;

export async function listMcpToolSettings(
  sqlExecutor: MemorySqlExecutor,
): Promise<readonly McpToolSettingRow[]> {
  const rows = sqlExecutor.execute<McpToolSettingSqlRowCandidate>(
    'SELECT namespaced_name, server_id, tool_name, is_enabled, safety FROM mcp_tool_settings',
  );
  // Dropped rather than repaired: a corrupt safety level would otherwise decide
  // whether an unreviewed tool runs without asking the owner.
  return rows.flatMap((row) => {
    const parsedRow = mcpToolSettingSqlRowSchema.safeParse(row);
    if (!parsedRow.success) {
      return [];
    }
    return [
      {
        namespacedName: parsedRow.data.namespaced_name,
        serverId: parsedRow.data.server_id,
        toolName: parsedRow.data.tool_name,
        isEnabled: parsedRow.data.is_enabled !== 0,
        safety: parsedRow.data.safety,
      },
    ];
  });
}

export async function saveMcpToolSetting(
  sqlExecutor: MemorySqlExecutor,
  settingRow: McpToolSettingRow,
): Promise<void> {
  sqlExecutor.execute(
    'INSERT INTO mcp_tool_settings (namespaced_name, server_id, tool_name, is_enabled, safety) VALUES (?, ?, ?, ?, ?) ON CONFLICT(namespaced_name) DO UPDATE SET server_id = excluded.server_id, tool_name = excluded.tool_name, is_enabled = excluded.is_enabled, safety = excluded.safety',
    settingRow.namespacedName,
    settingRow.serverId,
    settingRow.toolName,
    settingRow.isEnabled ? 1 : 0,
    settingRow.safety,
  );
}

export async function deleteMcpToolSettingsForServer(
  sqlExecutor: MemorySqlExecutor,
  serverId: string,
): Promise<void> {
  sqlExecutor.execute('DELETE FROM mcp_tool_settings WHERE server_id = ?', serverId);
}

// Matched on the raw identity rather than the namespaced name: the name is a
// lossy rendering of it, so looking up by name could hand one tool the row the
// owner approved for another.
export function findMcpToolSetting(
  settingList: readonly McpToolSettingRow[],
  serverId: string,
  toolName: string,
): McpToolSettingRow | undefined {
  return settingList.find(
    (settingRow) => settingRow.serverId === serverId && settingRow.toolName === toolName,
  );
}
