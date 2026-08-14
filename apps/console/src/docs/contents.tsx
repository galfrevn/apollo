import {
  DOCS_CHAPTER_LIST,
  DOCS_PART_LIST,
  formatDocsChapterNumber,
} from '@/docs/catalog';
import { DOCS_MESSAGES } from '@/docs/copy';
import { buildChapterPath, handleChapterLinkClick } from '@/docs/route';

export function DocsContents() {
  const docsMessages = DOCS_MESSAGES;

  return (
    <section className="settle">
      <h1 className="font-serif text-[clamp(40px,5vw,56px)] leading-[1.05] tracking-[-0.015em] text-balance">
        {docsMessages.contentsTitle}
      </h1>
      <p className="mt-4 max-w-[46ch] text-[16.5px] leading-relaxed text-muted-foreground">
        {docsMessages.contentsTagline}
      </p>
      <div className="mt-12 grid gap-10 sm:grid-cols-2">
        {DOCS_PART_LIST.map((part) => (
          <div key={part.title}>
            <span className="mb-3 block text-xs text-muted-foreground">{part.title}</span>
            {DOCS_CHAPTER_LIST.filter(
              (chapterEntry) => chapterEntry.partTitle === part.title,
            ).map((chapterEntry) => (
              <a
                key={chapterEntry.slug}
                href={buildChapterPath(chapterEntry.slug)}
                onClick={(event) => handleChapterLinkClick(event, chapterEntry.slug)}
                className="flex items-baseline gap-3 py-1.5 text-sm text-foreground/80 transition-colors duration-150 hover:text-foreground"
              >
                <span className="min-w-[18px] font-mono text-[11.5px] tabular-nums text-dim">
                  {formatDocsChapterNumber(chapterEntry.number)}
                </span>
                {chapterEntry.title}
                <span
                  aria-hidden
                  className="flex-1 -translate-y-[3px] border-b border-dotted border-border-hover"
                />
              </a>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
