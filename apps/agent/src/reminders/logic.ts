import { deliverReminderPayloadSchema } from '@/agents/rpc';

export const DELIVER_REMINDER_CALLBACK_NAME = 'deliverReminder';

export type AgentScheduleLike = {
  readonly id: string;
  readonly callback: string;
  readonly payload: unknown;
  readonly time: number;
  readonly type?: string;
  readonly delayInSeconds?: number;
};

export type ScheduledReminderRow = {
  readonly id: string;
  readonly message: string;
  readonly firesAtIso: string;
  readonly delayInSeconds?: number;
};

export function mapAgentScheduleListToReminderList(
  scheduleList: readonly AgentScheduleLike[],
): readonly ScheduledReminderRow[] {
  const reminderList: ScheduledReminderRow[] = [];
  for (const schedule of scheduleList) {
    if (schedule.callback !== DELIVER_REMINDER_CALLBACK_NAME) {
      continue;
    }
    const parsedPayload = deliverReminderPayloadSchema.safeParse(schedule.payload);
    if (!parsedPayload.success) {
      continue;
    }
    const reminderRow: ScheduledReminderRow = {
      id: schedule.id,
      message: parsedPayload.data.message,
      firesAtIso: new Date(schedule.time * 1000).toISOString(),
      ...(typeof schedule.delayInSeconds === 'number'
        ? { delayInSeconds: schedule.delayInSeconds }
        : {}),
    };
    reminderList.push(reminderRow);
  }
  return reminderList;
}

export function selectReminderRowsForCancel(
  reminderList: readonly ScheduledReminderRow[],
  input: {
    readonly message?: string;
    readonly cancelAll: boolean;
  },
): readonly ScheduledReminderRow[] {
  if (input.cancelAll) {
    return reminderList;
  }
  const trimmedMessage = input.message?.trim() ?? '';
  if (trimmedMessage.length === 0) {
    return [];
  }
  const needle = trimmedMessage.toLowerCase();
  return reminderList.filter((reminder) =>
    reminder.message.toLowerCase().includes(needle),
  );
}

function formatRelativeFireLabel(firesAtIso: string, nowMilliseconds: number): string {
  const remainingMilliseconds = Math.max(
    0,
    new Date(firesAtIso).getTime() - nowMilliseconds,
  );
  const remainingMinutes = Math.max(1, Math.round(remainingMilliseconds / 60_000));
  if (remainingMinutes < 90) {
    return `en ~${remainingMinutes} min`;
  }
  const remainingHours = Math.max(1, Math.round(remainingMinutes / 60));
  return `en ~${remainingHours} h`;
}

export function formatListRemindersSummary(
  reminderList: readonly ScheduledReminderRow[],
  nowMilliseconds: number,
): string {
  if (reminderList.length === 0) {
    return 'No hay recordatorios pendientes';
  }
  const fragmentList = reminderList.map(
    (reminder) =>
      `"${reminder.message}" ${formatRelativeFireLabel(reminder.firesAtIso, nowMilliseconds)}`,
  );
  return `${reminderList.length} recordatorios: ${fragmentList.join('; ')}`;
}

export function formatCancelRemindersSummary(input: {
  readonly cancelledMessageList: readonly string[];
  readonly searchedMessage?: string;
}): string {
  const cancelledCount = input.cancelledMessageList.length;
  if (cancelledCount === 0) {
    if (input.searchedMessage !== undefined && input.searchedMessage.trim().length > 0) {
      return `No encontré recordatorios que coincidan con "${input.searchedMessage.trim()}"`;
    }
    return 'No hay recordatorios para cancelar';
  }
  if (cancelledCount === 1) {
    return `Cancelé 1 recordatorio: ${input.cancelledMessageList[0]}`;
  }
  return `Cancelé ${cancelledCount} recordatorios`;
}
