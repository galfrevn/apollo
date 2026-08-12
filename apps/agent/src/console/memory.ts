import { parseStoredOwnerMemoryState } from '@/memory/consolidate';
import { OWNER_MEMORY_STATE_PREFERENCE_KEY } from '@/memory/nightly';
import {
  getSessionPreference,
  listRecentMemoryRecords,
  recallMemoryRecords,
} from '@/memory/store';
import type { OwnerFact } from '@/memory/consolidate';
import type { MemoryRecord, MemorySqlExecutor } from '@/memory/store';

export const CONSOLE_MEMORY_DEFAULT_LIMIT = 50;

export type ConsoleMemoryBrowseResult = {
  readonly memoryList: readonly MemoryRecord[];
  readonly ownerFactList: readonly OwnerFact[];
  readonly lastConsolidatedAtMilliseconds: number | null;
};

export async function browseConsoleMemory(
  sqlExecutor: MemorySqlExecutor,
  input: { readonly query?: string; readonly limit?: number },
): Promise<ConsoleMemoryBrowseResult> {
  const limit = input.limit ?? CONSOLE_MEMORY_DEFAULT_LIMIT;
  const trimmedQuery = input.query?.trim() ?? '';
  const memoryList =
    trimmedQuery.length === 0
      ? await listRecentMemoryRecords(sqlExecutor, limit)
      : await recallMemoryRecords(sqlExecutor, trimmedQuery, limit);

  const storedOwnerMemoryState = await getSessionPreference(
    sqlExecutor,
    OWNER_MEMORY_STATE_PREFERENCE_KEY,
  );
  const ownerMemoryState =
    storedOwnerMemoryState === null
      ? undefined
      : parseStoredOwnerMemoryState(storedOwnerMemoryState);

  return {
    memoryList,
    ownerFactList: ownerMemoryState?.factList ?? [],
    lastConsolidatedAtMilliseconds:
      ownerMemoryState?.lastConsolidatedAtMilliseconds ?? null,
  };
}
