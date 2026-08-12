import { useCallback, useEffect, useState } from 'react';

import { Empty } from '@/blueprint/empty';
import { Heading } from '@/blueprint/heading';
import { Panel } from '@/blueprint/panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConsoleRpc } from '@/agent/rpc';
import type { JobDocument } from '@/agent/schema';

function formatSizeLabel(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  return `${(sizeBytes / 1024).toFixed(1)} kB`;
}

export function JobsPage({ consoleRpc }: { readonly consoleRpc: ConsoleRpc }) {
  const [documentList, setDocumentList] = useState<readonly JobDocument[] | null>(null);
  const [openDocumentKey, setOpenDocumentKey] = useState<string | null>(null);
  const [openDocumentContent, setOpenDocumentContent] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const refreshDocumentList = useCallback(async () => {
    setErrorMessage(null);
    try {
      setDocumentList(await consoleRpc.listJobs());
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Could not list jobs.');
    }
  }, [consoleRpc]);

  useEffect(() => {
    void refreshDocumentList();
  }, [refreshDocumentList]);

  async function handleOpenDocument(documentKey: string) {
    if (openDocumentKey === documentKey) {
      setOpenDocumentKey(null);
      setOpenDocumentContent(null);
      return;
    }
    setOpenDocumentKey(documentKey);
    setOpenDocumentContent(null);
    try {
      const documentResult = await consoleRpc.getDocument(documentKey);
      setOpenDocumentContent(documentResult.content ?? 'Document not found.');
    } catch {
      setOpenDocumentContent('Could not load the document.');
    }
  }

  return (
    <div className="settle space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Heading description="Documents produced by research and coding runs">
          Jobs
        </Heading>
        <Button variant="outline" size="sm" onClick={() => void refreshDocumentList()}>
          Refresh
        </Button>
      </div>

      {errorMessage !== null && (
        <p
          role="alert"
          className="rounded-lg border border-danger/40 bg-dangerdim px-3 py-2 text-xs text-danger"
        >
          {errorMessage}
        </p>
      )}

      <Panel
        title="Run documents"
        meta={
          documentList !== null ? (
            <span className="text-xs text-faint">{documentList.length} documents</span>
          ) : undefined
        }
      >
        {documentList === null ? (
          <p className="p-4 text-sm text-muted">Loading…</p>
        ) : documentList.length === 0 ? (
          <Empty
            message="No run documents yet — ask the desk to research something"
            className="m-4"
          />
        ) : (
          <ul>
            {documentList.map((jobDocument) => (
              <li
                key={jobDocument.documentKey}
                className="border-b border-line last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => void handleOpenDocument(jobDocument.documentKey)}
                  aria-expanded={openDocumentKey === jobDocument.documentKey}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 hover:bg-raised"
                >
                  <Badge variant={jobDocument.kind === 'coding' ? 'amber' : 'outline'}>
                    {jobDocument.kind}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">
                    {jobDocument.documentKey.split('/').at(-1)}
                  </span>
                  <span className="shrink-0 text-xs whitespace-nowrap text-faint">
                    {new Date(jobDocument.uploadedAtIso).toLocaleString()} ·{' '}
                    {formatSizeLabel(jobDocument.sizeBytes)}
                  </span>
                </button>
                {openDocumentKey === jobDocument.documentKey && (
                  <div className="border-t border-line bg-ground px-4 py-3">
                    {openDocumentContent === null ? (
                      <p className="text-sm text-muted">Loading document…</p>
                    ) : (
                      <pre className="max-h-96 overflow-auto font-mono text-xs leading-relaxed whitespace-pre-wrap">
                        {openDocumentContent}
                      </pre>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
