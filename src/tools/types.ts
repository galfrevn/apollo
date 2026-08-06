import type { ScheduledReminderRow } from '@/reminders/logic';

export type ToolSafetyLevel = 'safe' | 'unsafe';

export type ToolExecutionResult = {
  readonly ok: boolean;
  readonly summary: string;
  readonly data?: unknown;
};

export type PendingToolConfirmation = {
  readonly id: string;
  readonly toolName: string;
  readonly args: unknown;
  readonly summary: string;
  readonly expiresAt: number;
};

export type DeskToolEffects = {
  readonly persistMemory: (
    content: string,
  ) => Promise<{ readonly memoryId: string; readonly content: string }>;
  readonly applyFocusMinutes: (minutes: number) => Promise<void>;
  readonly clearFocus: () => Promise<void>;
  readonly enqueueResearch: (prompt: string) => Promise<void>;
  readonly scheduleReminder: (input: {
    readonly delaySeconds: number;
    readonly message: string;
  }) => Promise<void>;
  readonly listReminders: () => Promise<readonly ScheduledReminderRow[]>;
  readonly cancelReminders: (input: {
    readonly message?: string;
    readonly cancelAll: boolean;
  }) => Promise<{
    readonly cancelledCount: number;
    readonly cancelledMessageList: readonly string[];
  }>;
  readonly resolveWeatherLocation: () => Promise<{
    readonly latitude: number;
    readonly longitude: number;
    readonly locationLabel: string;
    readonly timezone: string;
  }>;
  readonly persistWeatherLocation: (location: {
    readonly locationLabel: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly timezone: string;
  }) => Promise<void>;
};

export type ToolExecutionContext = {
  readonly environment: Env;
  readonly nowMilliseconds: number;
  readonly deviceId?: string;
  readonly effects?: DeskToolEffects;
};

export type ToolHandler = (
  args: unknown,
  context: ToolExecutionContext,
) => Promise<ToolExecutionResult>;

export type ToolDefinition = {
  readonly name: string;
  readonly safety: ToolSafetyLevel;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
  readonly handler: ToolHandler;
  readonly buildConfirmSummary?: (args: unknown) => string;
};

export const CONFIRM_TIMEOUT_MILLISECONDS = 30_000;
