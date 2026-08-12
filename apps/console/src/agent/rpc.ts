import { z } from 'zod';

import {
  consoleStatusSchema,
  listItemListSchema,
  mcpInstallResultSchema,
  mcpServerListSchema,
  memoryBrowseResultSchema,
  reminderListSchema,
} from '@/agent/schema';

type AgentCall = (method: string, args?: unknown[]) => Promise<unknown>;

export function createConsoleRpc(call: AgentCall, secret: string) {
  const invoke = async <Result>(
    method: string,
    resultSchema: z.ZodType<Result>,
    payload?: Record<string, unknown>,
  ): Promise<Result> => {
    const rawResult = await call(method, [{ secret, ...payload }]);
    return resultSchema.parse(rawResult);
  };

  return {
    getStatus: () => invoke('getConsoleStatus', consoleStatusSchema),
    browseMemory: (query?: string) =>
      invoke('browseConsoleMemory', memoryBrowseResultSchema, { query }),
    listLists: () => invoke('listConsoleLists', listItemListSchema),
    listReminders: () => invoke('listConsoleReminders', reminderListSchema),
    cancelReminder: (reminderId: string) =>
      invoke('cancelConsoleReminder', reminderListSchema, { reminderId }),
    listMcpServers: () => invoke('listMcpServers', mcpServerListSchema),
    installMcpServer: (name: string, url: string) =>
      invoke('installMcpServer', mcpInstallResultSchema, { name, url }),
    uninstallMcpServer: (serverId: string) =>
      invoke('uninstallMcpServer', mcpServerListSchema, { serverId }),
    setToolEnabled: (serverId: string, toolName: string, isEnabled: boolean) =>
      invoke(isEnabled ? 'enableMcpTool' : 'disableMcpTool', mcpServerListSchema, {
        serverId,
        toolName,
      }),
  };
}

export type ConsoleRpc = ReturnType<typeof createConsoleRpc>;
