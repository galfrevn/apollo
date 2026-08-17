import type { Session } from 'agents/experimental/memory/session';

import {
  addListItemRecord,
  listListItemRecords,
  removeListItemRecords,
} from '@/lists/store';
import { rememberFactInSession } from '@/memory/session';
import { addMemoryRecord, type MemorySqlExecutor } from '@/memory/store';
import type { JobPublisher } from '@/platform/jobs';
import {
  enqueueBackgroundJob,
  enqueueCodingJob,
  enqueueMemoryIndexJob,
} from '@/queues/consume';
import type { DeskToolEffects } from '@/tools/types';

export function createDeskToolEffects(input: {
  readonly sqlExecutor: MemorySqlExecutor;
  readonly jobPublisher: JobPublisher;
  readonly deviceId: string;
  readonly session: Session;
  readonly applyFocusMinutes: (minutes: number) => Promise<void>;
  readonly clearFocus: () => Promise<void>;
  readonly scheduleReminder: (input: {
    delaySeconds: number;
    message: string;
  }) => Promise<void>;
  readonly broadcastTimerProgress: DeskToolEffects['broadcastTimerProgress'];
  readonly listReminders: DeskToolEffects['listReminders'];
  readonly cancelReminders: DeskToolEffects['cancelReminders'];
  readonly resolveWeatherLocation: DeskToolEffects['resolveWeatherLocation'];
  readonly persistWeatherLocation: DeskToolEffects['persistWeatherLocation'];
  readonly searchThreadHistory: DeskToolEffects['searchThreadHistory'];
  readonly resumeConversationThread: DeskToolEffects['resumeConversationThread'];
  readonly callDeviceTool: DeskToolEffects['callDeviceTool'];
  readonly callInstalledMcpTool: DeskToolEffects['callInstalledMcpTool'];
}): DeskToolEffects {
  return {
    persistMemory: async (content) => {
      const memoryRecord = await addMemoryRecord(input.sqlExecutor, content);
      await rememberFactInSession(input.session, content);
      await enqueueMemoryIndexJob(input.jobPublisher, {
        memoryId: memoryRecord.id,
        content,
        deviceId: input.deviceId,
      });
      return { memoryId: memoryRecord.id, content };
    },
    applyFocusMinutes: input.applyFocusMinutes,
    clearFocus: input.clearFocus,
    enqueueResearch: async (prompt) => {
      await enqueueBackgroundJob(input.jobPublisher, {
        prompt,
        deviceId: input.deviceId,
      });
    },
    enqueueCodingTask: async ({ repository, task }) => {
      await enqueueCodingJob(input.jobPublisher, {
        repository,
        task,
        deviceId: input.deviceId,
      });
    },
    scheduleReminder: input.scheduleReminder,
    broadcastTimerProgress: input.broadcastTimerProgress,
    listReminders: input.listReminders,
    cancelReminders: input.cancelReminders,
    resolveWeatherLocation: input.resolveWeatherLocation,
    persistWeatherLocation: input.persistWeatherLocation,
    searchThreadHistory: input.searchThreadHistory,
    resumeConversationThread: input.resumeConversationThread,
    callDeviceTool: input.callDeviceTool,
    callInstalledMcpTool: input.callInstalledMcpTool,
    addListItem: async (item) => addListItemRecord(input.sqlExecutor, item),
    listListItems: async (listName) => listListItemRecords(input.sqlExecutor, listName),
    removeListItems: async (removal) => removeListItemRecords(input.sqlExecutor, removal),
  };
}
