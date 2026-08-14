import { useEffect, useMemo, useRef, useState } from 'react';

import { Icons } from '@/components/icons';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { DOCS_CHAPTER_LIST, formatDocsChapterNumber } from '@/docs/catalog';
import { DOCS_MESSAGES } from '@/docs/copy';
import { buildDocsSearchCorpus, foldSearchText, searchDocsSections } from '@/docs/corpus';
import { navigateToChapter, navigateToChapterHeading } from '@/docs/route';

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

import type { DocsChapterEntry } from '@/docs/catalog';
import type { DocsSearchMatch } from '@/docs/corpus';

const SECTION_RESULT_LIMIT = 9;

type DocsSearchResult =
  | { readonly kind: 'chapter'; readonly chapterEntry: DocsChapterEntry }
  | { readonly kind: 'section'; readonly match: DocsSearchMatch };

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  );
}

function buildResultList(
  sectionList: ReturnType<typeof buildDocsSearchCorpus>,
  rawQuery: string,
): readonly DocsSearchResult[] {
  const foldedQuery = foldSearchText(rawQuery.trim()).replace(/\s+/g, ' ');
  if (foldedQuery === '') {
    return DOCS_CHAPTER_LIST.map((chapterEntry) => ({ kind: 'chapter', chapterEntry }));
  }
  const chapterResultList: DocsSearchResult[] = DOCS_CHAPTER_LIST.filter(
    (chapterEntry) =>
      foldSearchText(chapterEntry.title).includes(foldedQuery) ||
      foldSearchText(chapterEntry.description).includes(foldedQuery),
  ).map((chapterEntry) => ({ kind: 'chapter', chapterEntry }));
  const sectionResultList: DocsSearchResult[] = searchDocsSections(
    sectionList,
    rawQuery,
    SECTION_RESULT_LIMIT,
  ).map((match) => ({ kind: 'section', match }));
  return [...chapterResultList, ...sectionResultList];
}

export function DocsSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listReference = useRef<HTMLUListElement | null>(null);
  const docsMessages = DOCS_MESSAGES;
  const sectionList = useMemo(() => buildDocsSearchCorpus(), []);
  const resultList = useMemo(
    () => buildResultList(sectionList, query),
    [sectionList, query],
  );

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsOpen((wasOpen) => !wasOpen);
        return;
      }
      if (event.key === '/' && !isTypingTarget(event.target)) {
        event.preventDefault();
        setIsOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    listReference.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  function closeAndReset() {
    setIsOpen(false);
    setQuery('');
  }

  function handleSelectResult(result: DocsSearchResult) {
    closeAndReset();
    if (result.kind === 'chapter') {
      navigateToChapter(result.chapterEntry.slug);
      return;
    }
    const { section } = result.match;
    if (section.headingText === null) {
      navigateToChapter(section.chapterEntry.slug);
      return;
    }
    navigateToChapterHeading(section.chapterEntry.slug, section.headingText);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((previousIndex) =>
        resultList.length === 0 ? 0 : (previousIndex + 1) % resultList.length,
      );
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((previousIndex) =>
        resultList.length === 0
          ? 0
          : (previousIndex - 1 + resultList.length) % resultList.length,
      );
    }
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
              const activeResult = resultList[activeIndex];
              if (activeResult !== undefined) {
                handleSelectResult(activeResult);
              }
            }}
            className="flex items-center gap-3 border-b px-4 pr-12"
          >
            <Icons.Search size={18} className="shrink-0 text-dim" />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder={docsMessages.searchPlaceholder}
              aria-label={docsMessages.searchTriggerLabel}
              aria-activedescendant={
                resultList.length === 0 ? undefined : `docs-search-result-${activeIndex}`
              }
              className="h-12 w-full bg-transparent text-sm text-foreground outline-none"
            />
          </form>
          <ul
            ref={listReference}
            role="listbox"
            className="max-h-[340px] overflow-y-auto p-2"
          >
            {resultList.length === 0 ? (
              <li className="px-3 py-6 text-center text-xs text-dim">
                {docsMessages.searchNoMatchesLabel}
              </li>
            ) : (
              resultList.map((result, resultIndex) => {
                const isActive = resultIndex === activeIndex;
                const rowClassName = `w-full px-3 text-left text-sm transition-colors duration-150 ${
                  isActive ? 'bg-accent text-foreground' : 'text-muted-foreground'
                }`;
                if (result.kind === 'chapter') {
                  return (
                    <li key={`chapter-${result.chapterEntry.slug}`}>
                      <button
                        type="button"
                        id={`docs-search-result-${resultIndex}`}
                        role="option"
                        aria-selected={isActive}
                        onClick={() => handleSelectResult(result)}
                        onPointerMove={() => setActiveIndex(resultIndex)}
                        className={`${rowClassName} flex h-10 items-center`}
                      >
                        <span className="flex w-full items-baseline gap-3">
                          <span className="min-w-[18px] font-mono text-[11px] tabular-nums text-dim">
                            {formatDocsChapterNumber(result.chapterEntry.number)}
                          </span>
                          {result.chapterEntry.title}
                          <span className="ml-auto hidden text-xs text-dim sm:inline">
                            {result.chapterEntry.partTitle}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                }
                const { section, snippet } = result.match;
                const resultKey = `section-${section.chapterEntry.slug}-${section.headingText ?? 'intro'}`;
                return (
                  <li key={resultKey}>
                    <button
                      type="button"
                      id={`docs-search-result-${resultIndex}`}
                      role="option"
                      aria-selected={isActive}
                      onClick={() => handleSelectResult(result)}
                      onPointerMove={() => setActiveIndex(resultIndex)}
                      className={`${rowClassName} py-2.5`}
                    >
                      <span className="flex items-baseline gap-3">
                        <span className="min-w-[18px] font-mono text-[11px] tabular-nums text-dim">
                          {formatDocsChapterNumber(section.chapterEntry.number)}
                        </span>
                        {section.headingText ?? section.chapterEntry.title}
                        <span className="ml-auto hidden text-xs text-dim sm:inline">
                          {section.chapterEntry.title}
                        </span>
                      </span>
                      {snippet === null ? null : (
                        <span className="mt-1 block truncate pl-[30px] text-xs text-dim">
                          {snippet.beforeText}
                          <mark className="bg-transparent font-medium text-foreground">
                            {snippet.matchText}
                          </mark>
                          {snippet.afterText}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
