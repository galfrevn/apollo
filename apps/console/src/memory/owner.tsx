import { Empty } from '@/blueprint/empty';
import { Badge } from '@/components/ui/badge';
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
  const { ownerFactList, lastConsolidatedAtMilliseconds } = browseResult;
  if (ownerFactList.length === 0) {
    return (
      <Empty message="No consolidated owner memory yet — it builds nightly from conversations" />
    );
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
            className="flex items-start gap-3 border-b border-line px-4 py-2.5 last:border-b-0"
          >
            <Badge variant="outline" className="mt-0.5 shrink-0">
              {fact.category}
            </Badge>
            <p className="min-w-0 flex-1 text-sm">{fact.content}</p>
            {fact.sourceCount > 1 && (
              <span className="shrink-0 text-xs text-faint">×{fact.sourceCount}</span>
            )}
          </li>
        ))}
      </ul>
      {lastConsolidatedAtMilliseconds !== null && (
        <p className="border-t border-line px-4 py-2 text-xs text-faint">
          Consolidated {new Date(lastConsolidatedAtMilliseconds).toLocaleString()}
        </p>
      )}
    </div>
  );
}
