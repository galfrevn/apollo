import { useEffect, useState } from 'react';

import { Icons } from '@/components/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DOCS_CHAPTER_LIST, formatDocsChapterNumber } from '@/docs/catalog';
import { DOCS_MESSAGE_CATALOG } from '@/docs/copy';
import { navigateToChapter } from '@/docs/route';
import { useMessages } from '@/locale/context';

export function DocsSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const docsMessages = useMessages(DOCS_MESSAGE_CATALOG);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen((wasOpen) => !wasOpen);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const matchingChapterList = DOCS_CHAPTER_LIST.filter(
    (chapterEntry) =>
      chapterEntry.title.toLowerCase().includes(normalizedQuery) ||
      chapterEntry.description.toLowerCase().includes(normalizedQuery),
  );

  function handleSelectChapter(chapterSlug: string) {
    setIsOpen(false);
    setQuery('');
    navigateToChapter(chapterSlug);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-8 items-center gap-2 text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground md:min-w-[230px] md:justify-between md:border md:bg-card md:px-2.5 md:text-[13px] md:text-dim md:hover:border-border-hover md:hover:text-muted-foreground"
      >
        <Icons.Search size={18} className="md:hidden" />
        <span className="hidden md:inline">{docsMessages.searchTriggerLabel}</span>
        <kbd className="hidden h-5 items-center border bg-accent px-1.5 font-sans text-[10px] text-muted-foreground md:inline-flex">
          ⌘K
        </kbd>
      </button>

      <Dialog
        open={isOpen}
        onOpenChange={(isNowOpen) => {
          setIsOpen(isNowOpen);
          if (!isNowOpen) {
            setQuery('');
          }
        }}
      >
        <DialogContent className="top-[20%] translate-y-0 p-0">
          <DialogTitle className="sr-only">{docsMessages.searchTriggerLabel}</DialogTitle>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const firstMatch = matchingChapterList[0];
              if (firstMatch !== undefined) {
                handleSelectChapter(firstMatch.slug);
              }
            }}
            className="flex items-center gap-3 border-b px-4 pr-12"
          >
            <Icons.Search size={18} className="shrink-0 text-dim" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={docsMessages.searchPlaceholder}
              aria-label={docsMessages.searchTriggerLabel}
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
            />
          </form>
          <ul className="p-2">
            {matchingChapterList.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-dim">
                {docsMessages.searchNoMatchesLabel}
              </li>
            ) : (
              matchingChapterList.map((chapterEntry) => (
                <li key={chapterEntry.slug}>
                  <button
                    type="button"
                    onClick={() => handleSelectChapter(chapterEntry.slug)}
                    className="flex h-10 w-full items-baseline gap-3 px-3 text-left text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
                  >
                    <span className="min-w-[18px] font-mono text-[11px] tabular-nums text-dim">
                      {formatDocsChapterNumber(chapterEntry.number)}
                    </span>
                    {chapterEntry.title}
                    <span className="ml-auto hidden text-xs text-dim sm:inline">
                      {chapterEntry.partTitle}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
