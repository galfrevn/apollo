import { cn } from '@/components/utility';
import { DOCS_PART_LIST_MAP, formatDocsChapterNumber } from '@/docs/catalog';
import { DOCS_MESSAGE_CATALOG } from '@/docs/copy';
import { buildChapterPath, handleChapterLinkClick } from '@/docs/route';
import { useLocale, useMessages } from '@/locale/context';

export function DocsNav({
  activeChapterSlug,
}: {
  readonly activeChapterSlug: string | null;
}) {
  const { locale } = useLocale();
  const docsMessages = useMessages(DOCS_MESSAGE_CATALOG);

  return (
    <nav
      aria-label={docsMessages.navigationAriaLabel}
      className="sticky top-[60px] hidden h-[calc(100vh-60px)] overflow-y-auto border-r px-4 pb-11 pt-7 md:block"
    >
      {DOCS_PART_LIST_MAP[locale].map((partEntry) => (
        <div key={partEntry.title} className="mb-6">
          <span className="mb-1.5 block px-2.5 text-xs text-muted-foreground">
            {partEntry.title}
          </span>
          {partEntry.chapterEntryList.map((chapterEntry) => (
            <a
              key={chapterEntry.slug}
              href={buildChapterPath(chapterEntry.slug)}
              aria-current={chapterEntry.slug === activeChapterSlug ? 'page' : undefined}
              onClick={(event) => handleChapterLinkClick(event, chapterEntry.slug)}
              className={cn(
                'flex items-baseline gap-2.5 border border-transparent px-2.5 py-[5px] text-[13px] transition-colors duration-150',
                chapterEntry.slug === activeChapterSlug
                  ? 'border-border bg-active text-foreground'
                  : 'text-dim hover:bg-card-hover hover:text-foreground',
              )}
            >
              <span className="min-w-[18px] font-mono text-[11px] tabular-nums">
                {formatDocsChapterNumber(chapterEntry.number)}
              </span>
              {chapterEntry.title}
            </a>
          ))}
        </div>
      ))}
    </nav>
  );
}
