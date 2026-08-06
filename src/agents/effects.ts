import type { Session } from 'agents/experimental/memory/session';

import { rememberFactInSession } from '@/memory/session';
import { addMemoryRecord, type MemorySqlExecutor } from '@/memory/store';
import { enqueueBackgroundJob, enqueueMemoryIndexJob } from '@/queues/consume';
import type { DeskToolEffects } from '@/tools/types';

export function createDeskToolEffects(input: {
  readonly sqlExecutor: MemorySqlExecutor;
  readonly environment: Env;
  readonly deviceId: string;
  readonly session: Session;
  readonly applyFocusMinutes: (minutes: number) => Promise<void>;
  readonly clearFocus: () => Promise<void>;
  readonly scheduleReminder: (input: {
    delaySeconds: number;
    message: string;
  }) => Promise<void>;
  readonly listReminders: DeskToolEffects['listReminders'];
  readonly cancelReminders: DeskToolEffects['cancelReminders'];
  readonly resolveWeatherLocation: DeskToolEffects['resolveWeatherLocation'];
  readonly persistWeatherLocation: DeskToolEffects['persistWeatherLocation'];
}): DeskToolEffects {
  return {
    persistMemory: async (content) => {
      const memoryRecord = await addMemoryRecord(input.sqlExecutor, content);
      await rememberFactInSession(input.session, content);
      await enqueueMemoryIndexJob(input.environment, {
        memoryId: memoryRecord.id,
        content,
        deviceId: input.deviceId,
      });
      return { memoryId: memoryRecord.id, content };
    },
    applyFocusMinutes: input.applyFocusMinutes,
    clearFocus: input.clearFocus,
    enqueueResearch: async (prompt) => {
      await enqueueBackgroundJob(input.environment, {
        prompt,
        deviceId: input.deviceId,
      });
    },
    scheduleReminder: input.scheduleReminder,
    listReminders: input.listReminders,
    cancelReminders: input.cancelReminders,
    resolveWeatherLocation: input.resolveWeatherLocation,
    persistWeatherLocation: input.persistWeatherLocation,
  };
}
