import { Database } from 'bun:sqlite';
import { parseCronExpression } from 'cron-schedule';

const SCHEDULE_TABLE_DDL = `CREATE TABLE IF NOT EXISTS host_schedules (
  id TEXT PRIMARY KEY,
  callback TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  type TEXT NOT NULL,
  time INTEGER NOT NULL,
  delay_in_seconds INTEGER,
  cron TEXT,
  interval_seconds INTEGER
)`;

// Mirrors the SDK's Schedule union exactly: the reminder store reads
// listSchedules() rows through AgentScheduleLike, and time is epoch seconds.
export type HostSchedule = {
  readonly id: string;
  readonly callback: string;
  readonly payload: unknown;
} & (
  | { readonly type: 'scheduled'; readonly time: number }
  | { readonly type: 'delayed'; readonly time: number; readonly delayInSeconds: number }
  | { readonly type: 'cron'; readonly time: number; readonly cron: string }
  | {
      readonly type: 'interval';
      readonly time: number;
      readonly intervalSeconds: number;
    }
);

export type HostScheduler = {
  schedule(
    when: number | Date | string,
    callbackName: string,
    payload?: unknown,
  ): Promise<HostSchedule>;
  scheduleEvery(
    intervalSeconds: number,
    callbackName: string,
    payload?: unknown,
  ): Promise<HostSchedule>;
  listSchedules(): Promise<readonly HostSchedule[]>;
  cancelSchedule(scheduleId: string): Promise<boolean>;
  start(): Promise<void>;
  stop(): void;
};

type ScheduleRow = {
  id: string;
  callback: string;
  payload_json: string;
  type: string;
  time: number;
  delay_in_seconds: number | null;
  cron: string | null;
  interval_seconds: number | null;
};

const MAX_TIMER_DELAY_MILLISECONDS = 2_147_483_647;

export function createBunScheduler(input: {
  readonly database: Database;
  readonly dispatch: (schedule: HostSchedule) => Promise<void>;
  readonly nowMilliseconds?: () => number;
}): HostScheduler {
  const { database, dispatch } = input;
  const nowMilliseconds = input.nowMilliseconds ?? (() => Date.now());
  database.run(SCHEDULE_TABLE_DDL);

  let armedTimer: ReturnType<typeof setTimeout> | undefined;
  let isRunning = false;
  let isDispatching = false;

  function readScheduleRowList(): ScheduleRow[] {
    return database
      .query('SELECT * FROM host_schedules ORDER BY time ASC')
      .all() as ScheduleRow[];
  }

  function insertSchedule(schedule: HostSchedule): void {
    database.run(
      `INSERT OR REPLACE INTO host_schedules
        (id, callback, payload_json, type, time, delay_in_seconds, cron, interval_seconds)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        schedule.callback,
        JSON.stringify(schedule.payload ?? null),
        schedule.type,
        schedule.time,
        schedule.type === 'delayed' ? schedule.delayInSeconds : null,
        schedule.type === 'cron' ? schedule.cron : null,
        schedule.type === 'interval' ? schedule.intervalSeconds : null,
      ],
    );
  }

  function armTimerForNextSchedule(): void {
    if (!isRunning) {
      return;
    }
    if (armedTimer !== undefined) {
      clearTimeout(armedTimer);
      armedTimer = undefined;
    }
    const nextRow = readScheduleRowList()[0];
    if (nextRow === undefined) {
      return;
    }
    const delayMilliseconds = Math.min(
      Math.max(0, nextRow.time * 1000 - nowMilliseconds()),
      MAX_TIMER_DELAY_MILLISECONDS,
    );
    armedTimer = setTimeout(() => {
      armedTimer = undefined;
      void dispatchDueSchedules();
    }, delayMilliseconds);
  }

  async function dispatchDueSchedules(): Promise<void> {
    if (isDispatching) {
      return;
    }
    isDispatching = true;
    try {
      let dueRow = readScheduleRowList().find(
        (row) => row.time * 1000 <= nowMilliseconds(),
      );
      while (dueRow !== undefined) {
        if (!isRunning) {
          break;
        }
        const schedule = mapScheduleRow(dueRow);
        if (schedule.type === 'cron') {
          const nextTime = Math.floor(
            parseCronExpression(schedule.cron)
              .getNextDate(new Date(nowMilliseconds()))
              .getTime() / 1000,
          );
          database.run('UPDATE host_schedules SET time = ? WHERE id = ?', [
            nextTime,
            schedule.id,
          ]);
        } else if (schedule.type === 'interval') {
          database.run('UPDATE host_schedules SET time = ? WHERE id = ?', [
            Math.floor(nowMilliseconds() / 1000) + schedule.intervalSeconds,
            schedule.id,
          ]);
        } else {
          database.run('DELETE FROM host_schedules WHERE id = ?', [schedule.id]);
        }
        try {
          await dispatch(schedule);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'host_schedule_dispatch_failed',
              scheduleId: schedule.id,
              callback: schedule.callback,
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
        dueRow = readScheduleRowList().find(
          (row) => row.time * 1000 <= nowMilliseconds(),
        );
      }
    } finally {
      isDispatching = false;
      armTimerForNextSchedule();
    }
  }

  return {
    async schedule(when, callbackName, payload) {
      const schedule = buildSchedule(when, callbackName, payload, nowMilliseconds());
      insertSchedule(schedule);
      armTimerForNextSchedule();
      return schedule;
    },
    async scheduleEvery(intervalSeconds, callbackName, payload) {
      const schedule: HostSchedule = {
        id: crypto.randomUUID(),
        callback: callbackName,
        payload: payload ?? null,
        type: 'interval',
        time: Math.floor(nowMilliseconds() / 1000) + intervalSeconds,
        intervalSeconds,
      };
      insertSchedule(schedule);
      armTimerForNextSchedule();
      return schedule;
    },
    async listSchedules() {
      return readScheduleRowList().map(mapScheduleRow);
    },
    async cancelSchedule(scheduleId) {
      const existingRowList = database
        .query('SELECT id FROM host_schedules WHERE id = ?')
        .all(scheduleId);
      database.run('DELETE FROM host_schedules WHERE id = ?', [scheduleId]);
      armTimerForNextSchedule();
      return existingRowList.length > 0;
    },
    async start() {
      isRunning = true;
      // Overdue schedules fire immediately on boot: the process may have been
      // down when a reminder or a nightly cron was due, and late beats lost.
      await dispatchDueSchedules();
    },
    stop() {
      isRunning = false;
      if (armedTimer !== undefined) {
        clearTimeout(armedTimer);
        armedTimer = undefined;
      }
    },
  };
}

function buildSchedule(
  when: number | Date | string,
  callbackName: string,
  payload: unknown,
  nowMillisecondsValue: number,
): HostSchedule {
  const scheduleId = crypto.randomUUID();
  if (typeof when === 'number') {
    return {
      id: scheduleId,
      callback: callbackName,
      payload: payload ?? null,
      type: 'delayed',
      time: Math.floor(nowMillisecondsValue / 1000) + when,
      delayInSeconds: when,
    };
  }
  if (when instanceof Date) {
    return {
      id: scheduleId,
      callback: callbackName,
      payload: payload ?? null,
      type: 'scheduled',
      time: Math.floor(when.getTime() / 1000),
    };
  }
  return {
    id: scheduleId,
    callback: callbackName,
    payload: payload ?? null,
    type: 'cron',
    time: Math.floor(
      parseCronExpression(when).getNextDate(new Date(nowMillisecondsValue)).getTime() /
        1000,
    ),
    cron: when,
  };
}

function mapScheduleRow(row: ScheduleRow): HostSchedule {
  const payload: unknown = JSON.parse(row.payload_json);
  if (row.type === 'delayed') {
    return {
      id: row.id,
      callback: row.callback,
      payload,
      type: 'delayed',
      time: row.time,
      delayInSeconds: row.delay_in_seconds ?? 0,
    };
  }
  if (row.type === 'cron') {
    return {
      id: row.id,
      callback: row.callback,
      payload,
      type: 'cron',
      time: row.time,
      cron: row.cron ?? '* * * * *',
    };
  }
  if (row.type === 'interval') {
    return {
      id: row.id,
      callback: row.callback,
      payload,
      type: 'interval',
      time: row.time,
      intervalSeconds: row.interval_seconds ?? 60,
    };
  }
  return {
    id: row.id,
    callback: row.callback,
    payload,
    type: 'scheduled',
    time: row.time,
  };
}
