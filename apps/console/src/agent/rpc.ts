import { z } from 'zod';

import {
  apolloStateSchema,
  consoleStatusSchema,
  deviceCommandResultSchema,
  historyTurnListSchema,
  jobDocumentContentSchema,
  jobDocumentListSchema,
  listItemListSchema,
  mcpInstallResultSchema,
  mcpServerListSchema,
  memoryBrowseResultSchema,
  reminderListSchema,
  threadSummaryListSchema,
  weatherLocationSchema,
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
    // confirmAction predates the console-rpc pattern: it takes a bare boolean
    // and is gated at connect time only, so it bypasses invoke().
    confirmPendingAction: async (isApproved: boolean) =>
      apolloStateSchema.parse(await call('confirmAction', [isApproved])),
    getStatus: () => invoke('getConsoleStatus', consoleStatusSchema),
    browseMemory: (query?: string) =>
      invoke('browseConsoleMemory', memoryBrowseResultSchema, { query }),
    listLists: () => invoke('listConsoleLists', listItemListSchema),
    listReminders: () => invoke('listConsoleReminders', reminderListSchema),
    cancelReminder: (reminderId: string) =>
      invoke('cancelConsoleReminder', reminderListSchema, { reminderId }),
    createReminder: (message: string, delaySeconds: number, isTimer: boolean) =>
      invoke('createConsoleReminder', reminderListSchema, {
        message,
        delaySeconds,
        isTimer,
      }),
    setDeviceVolume: (volume: number) =>
      invoke('setConsoleDeviceVolume', deviceCommandResultSchema, { volume }),
    setSpeechMode: (speechModeId: string) =>
      invoke('setConsoleSpeechMode', apolloStateSchema, { speechModeId }),
    setDeviceBrightness: (brightness: number) =>
      invoke('setConsoleDeviceBrightness', deviceCommandResultSchema, { brightness }),
    addMemory: (content: string) =>
      invoke('addConsoleMemory', memoryBrowseResultSchema, { content }),
    deleteMemory: (memoryId: string) =>
      invoke('deleteConsoleMemory', memoryBrowseResultSchema, { memoryId }),
    addListItem: (listName: string, content: string) =>
      invoke('addConsoleListItem', listItemListSchema, { listName, content }),
    removeListItem: (itemId: string) =>
      invoke('removeConsoleListItem', listItemListSchema, { itemId }),
    getWeather: () => invoke('getConsoleWeather', weatherLocationSchema),
    setWeather: (locationQuery: string) =>
      invoke('setConsoleWeather', weatherLocationSchema, { locationQuery }),
    listThreads: () => invoke('listConsoleThreads', threadSummaryListSchema),
    getThread: (threadId: string) =>
      invoke('getConsoleThread', historyTurnListSchema, { threadId }),
    listJobs: () => invoke('listConsoleJobs', jobDocumentListSchema),
    getDocument: (documentKey: string) =>
      invoke('getConsoleDocument', jobDocumentContentSchema, { documentKey }),
    listMcpServers: () => invoke('listMcpServers', mcpServerListSchema),
    installMcpServer: (name: string, url: string, authToken?: string) =>
      invoke('installMcpServer', mcpInstallResultSchema, { name, url, authToken }),
    uninstallMcpServer: (serverId: string) =>
      invoke('uninstallMcpServer', mcpServerListSchema, { serverId }),
    retryMcpServer: (serverId: string) =>
      invoke('retryMcpServer', mcpServerListSchema, { serverId }),
    setToolEnabled: (serverId: string, toolName: string, isEnabled: boolean) =>
      invoke(isEnabled ? 'enableMcpTool' : 'disableMcpTool', mcpServerListSchema, {
        serverId,
        toolName,
      }),
  };
}

export type ConsoleRpc = ReturnType<typeof createConsoleRpc>;
