import { z } from 'zod';

export const apolloStateSchema = z.object({
  uiState: z.enum([
    'idle',
    'listening',
    'thinking',
    'confirm',
    'speaking',
    'focus',
    'dashboard',
  ]),
  speechMode: z.string(),
  focusEndsAt: z.number().nullable(),
  focusStartedAt: z.number().nullable(),
  caption: z.string().nullable(),
  pendingConfirmId: z.string().nullable(),
  pendingConfirmSummary: z.string().nullable(),
});

export type ApolloAgentState = z.infer<typeof apolloStateSchema>;

export const telemetrySnapshotSchema = z.object({
  battery: z.number().optional(),
  charging: z.boolean().optional(),
  volume: z.number().optional(),
  wifiRssi: z.number().optional(),
  firmwareVersion: z.string().optional(),
  receivedAtMs: z.number(),
});

export type TelemetrySnapshot = z.infer<typeof telemetrySnapshotSchema>;

export const consoleStatusSchema = z.object({
  isDeviceConnected: z.boolean(),
  deviceConnectionCount: z.number(),
  telemetry: telemetrySnapshotSchema.nullable(),
  pendingReminderCount: z.number(),
  nowMilliseconds: z.number(),
});

export type ConsoleStatus = z.infer<typeof consoleStatusSchema>;

export const memoryRecordSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.number(),
});

export const ownerFactSchema = z.object({
  id: z.string(),
  content: z.string(),
  category: z.enum(['preference', 'fact', 'context', 'relationship']),
  lastConfirmedAtMilliseconds: z.number(),
  sourceCount: z.number(),
});

export const memoryBrowseResultSchema = z.object({
  memoryList: z.array(memoryRecordSchema),
  ownerFactList: z.array(ownerFactSchema),
  lastConsolidatedAtMilliseconds: z.number().nullable(),
});

export type MemoryBrowseResult = z.infer<typeof memoryBrowseResultSchema>;

export const listItemSchema = z.object({
  id: z.string(),
  listName: z.string(),
  content: z.string(),
  createdAt: z.number(),
});

export const listItemListSchema = z.array(listItemSchema);

export type ListItem = z.infer<typeof listItemSchema>;

export const reminderSchema = z.object({
  id: z.string(),
  message: z.string(),
  firesAtIso: z.string(),
  delayInSeconds: z.number().optional(),
});

export const reminderListSchema = z.array(reminderSchema);

export type Reminder = z.infer<typeof reminderSchema>;

export const mcpToolSummarySchema = z.object({
  namespacedName: z.string(),
  toolName: z.string(),
  description: z.string(),
  isEnabled: z.boolean(),
  safety: z.enum(['safe', 'unsafe']),
});

export const mcpServerSummarySchema = z.object({
  serverId: z.string(),
  name: z.string(),
  url: z.string(),
  state: z.string(),
  authUrl: z.string().nullable(),
  error: z.string().nullable(),
  toolList: z.array(mcpToolSummarySchema),
});

export const mcpServerListSchema = z.array(mcpServerSummarySchema);

export type McpServer = z.infer<typeof mcpServerSummarySchema>;

export const mcpInstallResultSchema = z.object({
  serverId: z.string(),
  state: z.string(),
  authUrl: z.string().nullable(),
});

export type McpInstallResult = z.infer<typeof mcpInstallResultSchema>;
