import { Empty } from '@/blueprint/empty';
import { Badge } from '@/components/ui/badge';
import { useLocale, useMessages } from '@/locale/context';
import { formatAbsoluteTimestamp } from '@/locale/format';
import { MEMORY_MESSAGE_CATALOG } from '@/memory/copy';
import type { MemoryBrowseResult } from '@/agent/schema';

const CATEGORY_ORDER: readonly string[] = [
  'preference',
  'fact',
  'context',
  'relationship',
];

export function OwnerFactBlock({
  browseResult,
}: {
  readonly browseResult: MemoryBrowseResult;
}) {
  const { locale } = useLocale();
  const memoryMessages = useMessages(MEMORY_MESSAGE_CATALOG);
  const { ownerFactList, lastConsolidatedAtMilliseconds } = browseResult;
  if (ownerFactList.length === 0) {
    return <Empty message={memoryMessages.ownerEmptyMessage} />;
  }
  const sortedFactList = [...ownerFactList].toSorted(
    (left, right) =>
      CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category),
  );
  return (
    <div>
      <ul>
        {sortedFactList.map((fact) => (
          <li
            key={fact.id}
            className="flex items-start gap-3 border-b px-4 py-2.5 last:border-b-0"
          >
            <Badge variant="outline" className="mt-0.5 shrink-0">
              {memoryMessages.categoryLabelMap[fact.category]}
            </Badge>
            <p className="min-w-0 flex-1 text-sm">{fact.content}</p>
            {fact.sourceCount > 1 && (
              <span className="shrink-0 text-xs text-dim">×{fact.sourceCount}</span>
            )}
          </li>
        ))}
      </ul>
      {lastConsolidatedAtMilliseconds !== null && (
        <p className="border-t px-4 py-2 text-xs text-dim">
          {memoryMessages.consolidatedAtLabel(
            formatAbsoluteTimestamp(new Date(lastConsolidatedAtMilliseconds), locale),
          )}
        </p>
      )}
    </div>
  );
}
