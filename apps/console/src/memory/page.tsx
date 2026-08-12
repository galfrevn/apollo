import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListsBlock } from '@/memory/lists';
import { OwnerFactBlock } from '@/memory/owner';
import type { ConsoleRpc } from '@/agent/rpc';
import type { ListItem, MemoryBrowseResult } from '@/agent/schema';

export function MemoryPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [browseResult, setBrowseResult] = useState<MemoryBrowseResult | null>(null);
  const [itemList, setItemList] = useState<readonly ListItem[] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const browseMemory = useCallback(
    async (query?: string) => {
      setErrorMessage(null);
      try {
        setBrowseResult(await consoleRpc.browseMemory(query));
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Could not browse memory.',
        );
      }
    },
    [consoleRpc],
  );

  useEffect(() => {
    void browseMemory();
    void consoleRpc
      .listLists()
      .then(setItemList)
      .catch(() => setItemList([]));
  }, [browseMemory, consoleRpc]);

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmedQuery = searchQuery.trim();
    void browseMemory(trimmedQuery.length === 0 ? undefined : trimmedQuery);
  }

  return (
    <div className="settle space-y-6">
      <Heading description="What the agent knows about its owner">Memory</Heading>

      {errorMessage !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-dangerdim px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </p>
      )}

      <Panel
        title="Owner memory"
        meta={<span className="text-xs text-faint">Nightly consolidation</span>}
      >
        {browseResult === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : (
          <OwnerFactBlock browseResult={browseResult} />
        )}
      </Panel>

      <Panel
        title="Raw memories"
        meta={
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search…"
              className="h-7 w-40 rounded-md text-xs"
              aria-label="Search memories"
            />
            <Button type="submit" variant="ghost" size="sm">
              Go
            </Button>
          </form>
        }
      >
        {browseResult === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : browseResult.memoryList.length === 0 ? (
          <Empty message="Nothing remembered yet" className="m-4" />
        ) : (
          <ul>
            {browseResult.memoryList.map((memoryRecord) => (
              <li
                key={memoryRecord.id}
                className="flex items-baseline gap-4 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <span className="shrink-0 text-xs text-faint">
                  {new Date(memoryRecord.createdAt).toLocaleDateString()}
                </span>
                <p className="min-w-0 flex-1 text-sm">{memoryRecord.content}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Lists">
        {itemList === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : (
          <div className="p-px">
            <ListsBlock itemList={itemList} />
          </div>
        )}
      </Panel>
    </div>
  );
}
