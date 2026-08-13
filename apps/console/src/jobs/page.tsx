import { useCallback, useEffect, useRef, useState } from 'react';
import { Streamdown } from 'streamdown';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/utility';
import { JOBS_MESSAGE_CATALOG } from '@/jobs/copy';
import { useLocale, useMessages } from '@/locale/context';
import { formatAbsoluteTimestamp } from '@/locale/format';
import type { ConsoleRpc } from '@/agent/rpc';
import type { JobDocument } from '@/agent/schema';

function formatSizeLabel(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  return `${(sizeBytes / 1024).toFixed(1)} kB`;
}

export function JobsPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const { locale } = useLocale();
  const jobsMessages = useMessages(JOBS_MESSAGE_CATALOG);
  const [documentList, setDocumentList] = useState<readonly JobDocument[] | null>(null);
  const [openDocumentKey, setOpenDocumentKey] = useState<string | null>(null);
  const [openDocumentContent, setOpenDocumentContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const openDocumentKeyRef = useRef<string | null>(null);

  const refreshDocumentList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setDocumentList(await consoleRpc.listJobs());
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : jobsMessages.listFallbackError,
      );
    }
  }, [consoleRpc, jobsMessages.listFallbackError]);

  useEffect(() => {
    void refreshDocumentList();
  }, [refreshDocumentList]);

  async function handleOpenDocument(documentKey: string) {
    openDocumentKeyRef.current = documentKey;
    setOpenDocumentKey(documentKey);
    setOpenDocumentContent(null);
    let loadedContent: string;
    try {
      const documentResult = await consoleRpc.getDocument(documentKey);
      loadedContent = documentResult.content ?? jobsMessages.documentNotFoundMessage;
    } catch {
      loadedContent = jobsMessages.documentLoadErrorMessage;
    }
    if (openDocumentKeyRef.current === documentKey) {
      setOpenDocumentContent(loadedContent);
    }
  }

  function handleCloseDocument() {
    openDocumentKeyRef.current = null;
    setOpenDocumentKey(null);
    setOpenDocumentContent(null);
  }

  const openDocument =
    documentList?.find((jobDocument) => jobDocument.documentKey === openDocumentKey) ??
    null;

  return (
    <div
      className={cn(
        'settle space-y-5 lg:transition-[margin-right] lg:duration-[400ms] lg:ease-[cubic-bezier(0.16,1,0.3,1)]',
        openDocumentKey !== null && 'lg:mr-[calc(100vw/3)]',
      )}
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description={jobsMessages.pageDescription}>
          {jobsMessages.pageTitle}
        </Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshDocumentList()}>
          {jobsMessages.refreshLabel}
        </Button>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
        >
          {errorMessage}
        </p>
      )}

      <Panel
        title={jobsMessages.panelTitle}
        meta={
          documentList !== null ? (
            <span className="text-xs text-dim">
              {jobsMessages.documentCountLabel(documentList.length)}
            </span>
          ) : undefined
        }
      >
        {documentList === null ? (
          <ul>
            {[0, 1, 2].map((rowIndex) => (
              <li
                key={rowIndex}
                className="flex items-center gap-3 border-b px-4 py-2.5 last:border-b-0"
              >
                <Skeleton className="h-5 w-[4.5rem]" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-3.5 w-44" />
              </li>
            ))}
          </ul>
        ) : documentList.length === 0 ? (
          <Empty message={jobsMessages.emptyMessage} className="m-4" />
        ) : (
          <ul>
            {documentList.map((jobDocument) => (
              <li key={jobDocument.documentKey} className="border-b last:border-b-0">
                <button
                  type="button"
                  onClick={() => void handleOpenDocument(jobDocument.documentKey)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-card-hover',
                    openDocumentKey === jobDocument.documentKey && 'bg-active',
                  )}
                >
                  <Badge variant={jobDocument.kind === 'coding' ? 'strong' : 'outline'}>
                    {jobsMessages.kindLabelMap[jobDocument.kind]}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {jobDocument.documentKey.split('/').at(-1)}
                  </span>
                  <span className="shrink-0 text-xs whitespace-nowrap text-dim">
                    {formatAbsoluteTimestamp(new Date(jobDocument.uploadedAtIso), locale)}{' '}
                    · {formatSizeLabel(jobDocument.sizeBytes)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet
        open={openDocumentKey !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleCloseDocument();
          }
        }}
      >
        <SheetContent aria-describedby={undefined}>
          <header className="flex h-[70px] shrink-0 flex-col justify-center gap-1 border-b px-5 pr-14">
            <SheetTitle className="truncate">
              {openDocumentKey?.split('/').at(-1)}
            </SheetTitle>
            {openDocument !== null && (
              <p className="truncate text-xs text-dim">
                {jobsMessages.kindLabelMap[openDocument.kind]} ·{' '}
                {formatAbsoluteTimestamp(new Date(openDocument.uploadedAtIso), locale)} ·{' '}
                {formatSizeLabel(openDocument.sizeBytes)}
              </p>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {openDocumentContent === null ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-full" />
                <Skeleton className="h-3.5 w-5/6" />
                <Skeleton className="h-3.5 w-3/4" />
              </div>
            ) : openDocumentKey?.endsWith('.md') ? (
              <div className="text-[13px] leading-relaxed [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_h4]:text-sm">
                <Streamdown>{openDocumentContent}</Streamdown>
              </div>
            ) : (
              <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {openDocumentContent}
              </pre>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
