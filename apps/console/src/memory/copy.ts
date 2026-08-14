import type { MemoryBrowseResult } from '@/agent/schema';

type OwnerFactCategory = MemoryBrowseResult['ownerFactList'][number]['category'];

interface MemoryMessages {
  readonly pageTitle: string;
  readonly pageDescription: string;
  readonly addMemoryFallbackError: string;
  readonly deleteMemoryFallbackError: string;
  readonly browseMemoryFallbackError: string;
  readonly ownerPanelTitle: string;
  readonly ownerPanelMeta: string;
  readonly ownerEmptyMessage: string;
  readonly categoryLabelMap: Record<OwnerFactCategory, string>;
  readonly consolidatedAtLabel: (formattedTimestamp: string) => string;
  readonly rawPanelTitle: string;
  readonly searchPlaceholder: string;
  readonly searchAriaLabel: string;
  readonly searchSubmitLabel: string;
  readonly newMemoryPlaceholder: string;
  readonly newMemoryAriaLabel: string;
  readonly savingLabel: string;
  readonly rememberLabel: string;
  readonly memoriesEmptyMessage: string;
  readonly forgetLabel: string;
  readonly listsPanelTitle: string;
  readonly listNamePlaceholder: string;
  readonly listNameAriaLabel: string;
  readonly listItemPlaceholder: string;
  readonly listItemAriaLabel: string;
  readonly addLabel: string;
  readonly listsEmptyMessage: string;
  readonly removeItemAriaLabel: (itemContent: string) => string;
}

export const MEMORY_MESSAGES: MemoryMessages = {
  pageTitle: 'Memory',
  pageDescription: 'What the agent knows about its owner',
  addMemoryFallbackError: 'Could not add memory.',
  deleteMemoryFallbackError: 'Could not delete memory.',
  browseMemoryFallbackError: 'Could not browse memory.',
  ownerPanelTitle: 'Owner memory',
  ownerPanelMeta: 'Nightly consolidation',
  ownerEmptyMessage:
    'No consolidated owner memory yet — it builds nightly from conversations',
  categoryLabelMap: {
    preference: 'preference',
    fact: 'fact',
    context: 'context',
    relationship: 'relationship',
  },
  consolidatedAtLabel: (formattedTimestamp) => `Consolidated ${formattedTimestamp}`,
  rawPanelTitle: 'Raw memories',
  searchPlaceholder: 'Search…',
  searchAriaLabel: 'Search memories',
  searchSubmitLabel: 'Go',
  newMemoryPlaceholder: 'Remember that…',
  newMemoryAriaLabel: 'New memory',
  savingLabel: 'Saving…',
  rememberLabel: 'Remember',
  memoriesEmptyMessage: 'Nothing remembered yet',
  forgetLabel: 'Forget',
  listsPanelTitle: 'Lists',
  listNamePlaceholder: 'List (e.g. super)',
  listNameAriaLabel: 'List name',
  listItemPlaceholder: 'New item…',
  listItemAriaLabel: 'Item content',
  addLabel: 'Add',
  listsEmptyMessage: 'No lists yet — add an item above or ask the desk',
  removeItemAriaLabel: (itemContent) => `Remove ${itemContent}`,
};
