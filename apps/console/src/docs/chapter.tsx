import { Streamdown } from 'streamdown';

import { DOCS_CHAPTER_LIST, formatDocsChapterNumber } from '@/docs/catalog';
import { DOCS_MESSAGE_CATALOG } from '@/docs/copy';
import { DOCS_BASE_PATH, buildChapterPath, handleChapterLinkClick } from '@/docs/route';
import { DOCS_SOURCE_MAP } from '@/docs/source';
import { useMessages } from '@/locale/context';

import type { DocsChapterEntry } from '@/docs/catalog';

const PROSE_CLASS_LIST = [
  '[&_p]:my-3.5 [&_p]:text-[15.5px] [&_p]:leading-[1.78] [&_p]:text-foreground/80',
  '[&_h2]:mb-3.5 [&_h2]:mt-14 [&_h2]:font-serif [&_h2]:text-[26px] [&_h2]:font-normal [&_h2]:leading-[1.25] [&_h2]:tracking-[-0.01em]',
  '[&_h3]:mt-9 [&_h3]:text-lg [&_h3]:font-normal',
  '[&_a]:border-b [&_a]:border-dashed [&_a]:border-muted-foreground/40 [&_a]:text-foreground [&_a:hover]:border-muted-foreground',
  '[&_blockquote]:my-5 [&_blockquote]:border-l [&_blockquote]:border-border-hover [&_blockquote]:pl-5 [&_blockquote_p]:text-muted-foreground',
  '[&_code]:rounded-none [&_code]:font-mono [&_code]:text-[0.82em]',
  '[&_[data-streamdown=inline-code]]:bg-accent [&_[data-streamdown=inline-code]]:px-1.5 [&_[data-streamdown=inline-code]]:py-0.5',
  '[&_[data-streamdown=code-block]]:my-5 [&_[data-streamdown=code-block]]:gap-0 [&_[data-streamdown=code-block]]:rounded-none [&_[data-streamdown=code-block]]:bg-card [&_[data-streamdown=code-block]]:p-0',
  '[&_[data-streamdown=code-block-header]]:h-10 [&_[data-streamdown=code-block-header]]:border-b [&_[data-streamdown=code-block-header]]:px-4 [&_[data-streamdown=code-block-header]]:text-dim',
  '[&_[data-streamdown=code-block-actions]]:rounded-none [&_[data-streamdown=code-block-actions]]:border-0 [&_[data-streamdown=code-block-actions]]:bg-transparent [&_[data-streamdown=code-block-actions]]:p-0 [&_[data-streamdown=code-block-actions]]:pr-2 [&_[data-streamdown=code-block-actions]]:backdrop-blur-none',
  '[&_[data-streamdown=code-block-body]]:rounded-none [&_[data-streamdown=code-block-body]]:border-0 [&_[data-streamdown=code-block-body]]:bg-transparent [&_[data-streamdown=code-block-body]]:p-4 [&_[data-streamdown=code-block-body]]:text-[13.5px] [&_[data-streamdown=code-block-body]]:leading-[1.7] [&_[data-streamdown=code-block-body]_code>span]:block',
  '[&_ul]:my-3.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-3.5 [&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li]:my-1.5 [&_li]:text-[15.5px] [&_li]:leading-[1.7] [&_li]:text-foreground/80',
  '[&_hr]:my-8 [&_hr]:border-border [&_table]:rounded-none',
  '[&_img]:my-6 [&_img]:w-full [&_img]:rounded-none [&_img]:border [&_img]:border-border',
  '[&_div:has(>table)]:my-5 [&_div:has(>table)]:rounded-none [&_div:has(>table)]:bg-card',
  '[&_th]:text-[13.5px] [&_td]:text-[14px] [&_td]:text-foreground/80',
].join(' ');

export function DocsChapter({
  chapterEntry,
}: {
  readonly chapterEntry: DocsChapterEntry;
}) {
  const docsMessages = useMessages(DOCS_MESSAGE_CATALOG);
  const chapterIndex = DOCS_CHAPTER_LIST.findIndex(
    (candidateEntry) => candidateEntry.slug === chapterEntry.slug,
  );
  const previousChapter = DOCS_CHAPTER_LIST[chapterIndex - 1] ?? null;
  const nextChapter = DOCS_CHAPTER_LIST[chapterIndex + 1] ?? null;
  const chapterSource = DOCS_SOURCE_MAP[chapterEntry.slug] ?? '';

  return (
    <article className="settle">
      <p className="font-mono text-xs text-dim">
        {formatDocsChapterNumber(chapterEntry.number)} · {chapterEntry.partTitle}
      </p>
      <h1 className="mt-3.5 font-serif text-[clamp(42px,6vw,62px)] leading-[1.05] tracking-[-0.015em] text-balance">
        {chapterEntry.title}
      </h1>
      <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-muted-foreground">
        {chapterEntry.description}
      </p>
      <hr className="my-10 w-12 border-border-hover" />

      <div className={PROSE_CLASS_LIST}>
        <Streamdown
          controls={{
            code: { copy: true, download: false },
            table: false,
            mermaid: false,
          }}
          lineNumbers={false}
          translations={{
            copyCode: docsMessages.copyCodeLabel,
            copied: docsMessages.copiedCodeLabel,
          }}
        >
          {chapterSource}
        </Streamdown>
      </div>

      <footer className="mt-20 border-t pt-3.5">
        <p className="mb-6 mt-2.5 text-center text-xs">
          <a
            href={DOCS_BASE_PATH}
            onClick={(event) => handleChapterLinkClick(event, null)}
            className="text-dim transition-colors duration-150 hover:text-foreground"
          >
            {docsMessages.buildChapterPositionLabel(
              chapterEntry.number,
              DOCS_CHAPTER_LIST.length,
            )}
          </a>
        </p>
        <div className="grid grid-cols-2 gap-6">
          {previousChapter === null ? (
            <span />
          ) : (
            <a
              href={buildChapterPath(previousChapter.slug)}
              onClick={(event) => handleChapterLinkClick(event, previousChapter.slug)}
              className="group block py-1.5"
            >
              <span className="mb-2 block text-xs text-dim">
                {docsMessages.previousChapterLabel}
              </span>
              <span className="block font-serif text-[23px] tracking-[-0.01em] transition-colors duration-150 group-hover:text-muted-foreground">
                {previousChapter.title}
              </span>
              <span className="mt-2 block font-mono text-xs text-dim">
                {formatDocsChapterNumber(previousChapter.number)}
              </span>
            </a>
          )}
          {nextChapter === null ? (
            <span />
          ) : (
            <a
              href={buildChapterPath(nextChapter.slug)}
              onClick={(event) => handleChapterLinkClick(event, nextChapter.slug)}
              className="group block py-1.5 text-right"
            >
              <span className="mb-2 block text-xs text-dim">
                {docsMessages.nextChapterLabel}
              </span>
              <span className="block font-serif text-[23px] tracking-[-0.01em] transition-colors duration-150 group-hover:text-muted-foreground">
                {nextChapter.title}
              </span>
              <span className="mt-2 block font-mono text-xs text-dim">
                {formatDocsChapterNumber(nextChapter.number)}
              </span>
            </a>
          )}
        </div>
      </footer>
    </article>
  );
}
