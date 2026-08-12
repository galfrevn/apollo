import { Empty } from '@/blueprint/empty';
import type { ListItem } from '@/agent/schema';

export function ListsBlock({ itemList }: { readonly itemList: readonly ListItem[] }) {
  if (itemList.length === 0) {
    return <Empty message="No lists yet — ask the desk to note something" />;
  }
  const groupedListMap = new Map<string, ListItem[]>();
  for (const item of itemList) {
    const groupList = groupedListMap.get(item.listName) ?? [];
    groupList.push(item);
    groupedListMap.set(item.listName, groupList);
  }
  return (
    <div className="grid gap-px bg-line sm:grid-cols-2">
      {[...groupedListMap.entries()].map(([listName, groupItemList]) => (
        <section key={listName} className="bg-panel p-4">
          <h3 className="label-soft flex items-baseline justify-between text-muted">
            {listName}
            <span className="text-faint">{groupItemList.length}</span>
          </h3>
          <ul className="mt-3 space-y-1.5">
            {groupItemList.map((item) => (
              <li key={item.id} className="flex gap-2 text-sm">
                <span aria-hidden className="mt-[0.5em] size-1 shrink-0 bg-faint" />
                {item.content}
              </li>
            ))}
          </ul>
        </section>
      ))}
      {groupedListMap.size % 2 === 1 && (
        <div aria-hidden className="hidden bg-panel sm:block" />
      )}
    </div>
  );
}
