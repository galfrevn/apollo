import conceptsSource from '@/docs/content/concepts.md?raw';
import loopSource from '@/docs/content/loop.md?raw';
import protocolSource from '@/docs/content/protocol.md?raw';
import purposeSource from '@/docs/content/purpose.md?raw';
import setupSource from '@/docs/content/setup.md?raw';

export const DOCS_SOURCE_MAP: Record<string, string> = {
  purpose: purposeSource,
  concepts: conceptsSource,
  loop: loopSource,
  protocol: protocolSource,
  setup: setupSource,
};
