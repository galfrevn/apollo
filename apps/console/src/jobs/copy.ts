import type { JobDocument } from '@/agent/schema';

type JobKind = JobDocument['kind'];

interface JobsMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly refreshLabel: string;
  readonly listFallbackError: string;
  readonly documentNotFoundMessage: string;
  readonly documentLoadErrorMessage: string;
  readonly panelTitle: string;
  readonly documentCountLabel: (documentCount: number) => string;
  readonly emptyMessage: string;
  readonly kindLabelMap: Record<JobKind, string>;
}

export const JOBS_MESSAGES: JobsMessages = {
  pageTitle: 'Jobs',
  pageDescription: 'Documents produced by research and coding runs',
  refreshLabel: 'Refresh',
  listFallbackError: 'Could not list jobs.',
  documentNotFoundMessage: 'Document not found.',
  documentLoadErrorMessage: 'Could not load the document.',
  panelTitle: 'Run documents',
  documentCountLabel: (documentCount) =>
    documentCount === 1 ? '1 document' : `${documentCount} documents`,
  emptyMessage: 'No run documents yet — ask the desk to research something',
  kindLabelMap: {
    research: 'research',
    coding: 'coding',
  },
};
