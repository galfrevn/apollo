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
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleAddMemory(event: FormEvent) {
    event.preventDefault();
    const trimmedContent = newMemoryContent.trim();
    if (trimmedContent.length === 0) {
      return;
    }
    setIsAddingMemory(true);
    setErrorMessage(null);
    try {
      setBrowseResult(await consoleRpc.addMemory(trimmedContent));
      setNewMemoryContent('');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not add memory.');
    } finally {
      setIsAddingMemory(false);
    }
  }

  async function handleDeleteMemory(memoryId: string) {
    setBusyMemoryId(memoryId);
    setErrorMessage(null);
    try {
      setBrowseResult(await consoleRpc.deleteMemory(memoryId));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Could not delete memory.',
      );
    } finally {
      setBusyMemoryId(null);
    }
  }

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
        <form
          onSubmit={handleAddMemory}
          className="flex gap-2 border-b border-line p-3"
          aria-busy={isAddingMemory}
        >
          <Input
            value={newMemoryContent}
            onChange={(event) => setNewMemoryContent(event.target.value)}
            placeholder="Remember that…"
            aria-label="New memory"
            className="h-8 flex-1 text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={isAddingMemory}>
            {isAddingMemory ? 'Saving…' : 'Remember'}
          </Button>
        </form>
        {browseResult === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : browseResult.memoryList.length === 0 ? (
          <Empty message="Nothing remembered yet" className="m-4" />
        ) : (
          <ul>
            {browseResult.memoryList.map((memoryRecord) => (
              <li
                key={memoryRecord.id}
                className="group flex items-baseline gap-4 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <span className="shrink-0 text-xs text-faint">
                  {new Date(memoryRecord.createdAt).toLocaleDateString()}
                </span>
                <p className="min-w-0 flex-1 text-sm">{memoryRecord.content}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busyMemoryId === memoryRecord.id}
                  onClick={() => void handleDeleteMemory(memoryRecord.id)}
                  className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-danger"
                >
                  Forget
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Lists">
        {itemList === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : (
          <ListsBlock
            itemList={itemList}
            onAdd={async (listName, content) => {
              setItemList(await consoleRpc.addListItem(listName, content));
            }}
            onRemove={async (itemId) => {
              setItemList(await consoleRpc.removeListItem(itemId));
            }}
          />
        )}
      </Panel>
    </div>
  );
}
