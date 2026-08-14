import { useState } from 'react';
import type { FormEvent } from 'react';

import { Empty } from '@/blueprint/empty';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { MEMORY_MESSAGES } from '@/memory/copy';
import type { ListItem } from '@/agent/schema';

function AddItemForm({
  onAdd,
}: {
  readonly onAdd: (listName: string, content: string) => Promise<void>;
}) {
  const memoryMessages = MEMORY_MESSAGES;
  const [listName, setListName] = useState('');
  const [content, setContent] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (listName.trim().length === 0 || content.trim().length === 0) {
      return;
    }
    setIsAdding(true);
    try {
      await onAdd(listName.trim(), content.trim());
      setContent('');
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap gap-2 border-b p-3"
      aria-busy={isAdding}
    >
      <Input
        value={listName}
        onChange={(event) => setListName(event.target.value)}
        placeholder={memoryMessages.listNamePlaceholder}
        aria-label={memoryMessages.listNameAriaLabel}
        className="h-8 w-36 text-xs"
      />
      <Input
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={memoryMessages.listItemPlaceholder}
        aria-label={memoryMessages.listItemAriaLabel}
        className="h-8 min-w-40 flex-1 text-xs"
      />
      <Button type="submit" variant="outline" size="sm" disabled={isAdding}>
        {memoryMessages.addLabel}
      </Button>
    </form>
  );
}

export function ListsBlock({
  itemList,
  onAdd,
  onRemove,
}: {
  readonly itemList: readonly ListItem[];
  readonly onAdd: (listName: string, content: string) => Promise<void>;
  readonly onRemove: (itemId: string) => Promise<void>;
}) {
  const memoryMessages = MEMORY_MESSAGES;
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  async function handleRemove(itemId: string) {
    setBusyItemId(itemId);
    try {
      await onRemove(itemId);
    } finally {
      setBusyItemId(null);
    }
  }

  const groupedListMap = new Map<string, ListItem[]>();
  for (const item of itemList) {
    const listGroupItemList = groupedListMap.get(item.listName) ?? [];
    listGroupItemList.push(item);
    groupedListMap.set(item.listName, listGroupItemList);
  }

  return (
    <div>
      <AddItemForm onAdd={onAdd} />
      {itemList.length === 0 ? (
        <Empty message={memoryMessages.listsEmptyMessage} className="m-3" />
      ) : (
        <div className="grid gap-px bg-border sm:grid-cols-2">
          {[...groupedListMap.entries()].map(([listName, listGroupItemList]) => (
            <section key={listName} className="bg-card p-4">
              <h3 className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
                {listName}
                <span className="text-dim">{listGroupItemList.length}</span>
              </h3>
              <ul className="mt-3 space-y-1">
                {listGroupItemList.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2 text-sm">
                    <span aria-hidden className="size-1 shrink-0 bg-dim" />
                    <span className="min-w-0 flex-1">{item.content}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemove(item.id)}
                      disabled={busyItemId === item.id}
                      aria-label={memoryMessages.removeItemAriaLabel(item.content)}
                      className="text-dim opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 disabled:opacity-50"
                    >
                      <Icons.Close size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {groupedListMap.size % 2 === 1 && (
            <div aria-hidden className="hidden bg-card sm:block" />
          )}
        </div>
      )}
    </div>
  );
}
