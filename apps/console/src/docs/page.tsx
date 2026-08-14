import { Icons } from '@/components/icons';
import { findDocsChapterBySlug } from '@/docs/catalog';
import { DocsChapter } from '@/docs/chapter';
import { DocsContents } from '@/docs/contents';
import { DOCS_MESSAGE_CATALOG } from '@/docs/copy';
import { useDocsMetadata } from '@/docs/metadata';
import { DocsNav } from '@/docs/nav';
import { DOCS_BASE_PATH, handleChapterLinkClick, useDocsChapterSlug } from '@/docs/route';
import { DocsSearch } from '@/docs/search';
import { LANDING_REPOSITORY_URL } from '@/landing/origin';
import { useLocale, useMessages } from '@/locale/context';
import { LocaleToggle } from '@/locale/toggle';
import { CONSOLE_BASE_PATH } from '@/router/route';

export function DocsPage() {
  const { locale } = useLocale();
  const activeChapterSlug = useDocsChapterSlug();
  const activeChapter =
    activeChapterSlug === null ? null : findDocsChapterBySlug(activeChapterSlug, locale);
  const docsMessages = useMessages(DOCS_MESSAGE_CATALOG);
  useDocsMetadata(activeChapter);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-10 flex h-[60px] items-center justify-between gap-4 border-b bg-background/70 px-5 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 text-sm">
          <a href="/" className="flex items-center gap-2.5">
            <Icons.LogoMark size={20} />
            Apollo
          </a>
          <a
            href={DOCS_BASE_PATH}
            onClick={(event) => handleChapterLinkClick(event, null)}
            className="text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {docsMessages.brandSectionLabel}
          </a>
        </div>
        <div className="flex items-center gap-5">
          <DocsSearch />
          <a
            href={LANDING_REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground sm:block"
          >
            {docsMessages.githubLabel}
          </a>
          <a
            href={CONSOLE_BASE_PATH}
            className="hidden text-[13px] text-muted-foreground transition-colors duration-150 hover:text-foreground sm:block"
          >
            {docsMessages.openConsoleLabel}
          </a>
          <LocaleToggle />
        </div>
      </header>

      <div className="mx-auto grid max-w-[1240px] grid-cols-1 pt-[60px] md:grid-cols-[270px_minmax(0,1fr)]">
        <DocsNav activeChapterSlug={activeChapterSlug} />
        <main className="min-w-0 px-6 py-12 md:px-10 md:py-[72px]">
          <div className="mx-auto max-w-[660px]">
            {activeChapter === null ? (
              <DocsContents />
            ) : (
              <DocsChapter key={activeChapter.slug} chapterEntry={activeChapter} />
            )}
          </div>
        </main>
      </div>
    </>
  );
}
