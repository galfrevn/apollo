import { describe, expect, it } from 'bun:test';

import {
  formatCancelRemindersSummary,
  formatListRemindersSummary,
  mapAgentScheduleListToReminderList,
  selectReminderRowsForCancel,
} from '@/reminders/logic';

describe('reminder schedule logic', () => {
  it('maps only deliverReminder schedules with valid payload', () => {
    const reminderList = mapAgentScheduleListToReminderList([
      {
        id: 'r1',
        callback: 'deliverReminder',
        payload: { message: 'tomá agua' },
        time: 1_775_000_000,
        type: 'delayed',
        delayInSeconds: 600,
      },
      {
        id: 'c1',
        callback: 'expireConfirm',
        payload: undefined,
        time: 1_775_000_100,
      },
      {
        id: 'w1',
        callback: 'refreshDashboardWeather',
        payload: undefined,
        time: 1_775_000_200,
        type: 'interval',
      },
      {
        id: 'bad',
        callback: 'deliverReminder',
        payload: { nope: true },
        time: 1_775_000_300,
      },
    ]);
    expect(reminderList).toEqual([
      {
        id: 'r1',
        message: 'tomá agua',
        firesAtIso: new Date(1_775_000_000 * 1000).toISOString(),
        delayInSeconds: 600,
      },
    ]);
  });

  it('selects by cancelAll or case-insensitive partial message', () => {
    const reminderList = [
      {
        id: '1',
        message: 'Tomá agua',
        firesAtIso: '2026-08-05T18:00:00.000Z',
      },
      {
        id: '2',
        message: 'standup',
        firesAtIso: '2026-08-05T19:00:00.000Z',
      },
    ];
    expect(
      selectReminderRowsForCancel(reminderList, { cancelAll: true }).map((row) => row.id),
    ).toEqual(['1', '2']);
    expect(
      selectReminderRowsForCancel(reminderList, {
        cancelAll: false,
        message: 'agua',
      }).map((row) => row.id),
    ).toEqual(['1']);
  });

  it('formats list and cancel summaries in Spanish', () => {
    expect(formatListRemindersSummary([], 0)).toBe('No hay recordatorios pendientes');
    expect(
      formatCancelRemindersSummary({
        cancelledMessageList: [],
        searchedMessage: 'agua',
      }),
    ).toContain('No encontré');
    expect(
      formatCancelRemindersSummary({
        cancelledMessageList: ['tomá agua'],
      }),
    ).toContain('Cancelé 1');
  });
});
