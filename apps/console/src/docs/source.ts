import capabilitiesEnglishSource from '@/docs/content/en/capabilities.md?raw';
import conceptsEnglishSource from '@/docs/content/en/concepts.md?raw';
import consoleEnglishSource from '@/docs/content/en/console.md?raw';
import firmwareEnglishSource from '@/docs/content/en/firmware.md?raw';
import loopEnglishSource from '@/docs/content/en/loop.md?raw';
import protocolEnglishSource from '@/docs/content/en/protocol.md?raw';
import purposeEnglishSource from '@/docs/content/en/purpose.md?raw';
import setupEnglishSource from '@/docs/content/en/setup.md?raw';
import skillsEnglishSource from '@/docs/content/en/skills.md?raw';
import capabilitiesSpanishSource from '@/docs/content/es/capabilities.md?raw';
import conceptsSpanishSource from '@/docs/content/es/concepts.md?raw';
import consoleSpanishSource from '@/docs/content/es/console.md?raw';
import firmwareSpanishSource from '@/docs/content/es/firmware.md?raw';
import loopSpanishSource from '@/docs/content/es/loop.md?raw';
import protocolSpanishSource from '@/docs/content/es/protocol.md?raw';
import purposeSpanishSource from '@/docs/content/es/purpose.md?raw';
import setupSpanishSource from '@/docs/content/es/setup.md?raw';
import skillsSpanishSource from '@/docs/content/es/skills.md?raw';

import type { Locale } from '@/locale/detect';

export const DOCS_SOURCE_MAP: Record<Locale, Record<string, string>> = {
  es: {
    purpose: purposeSpanishSource,
    concepts: conceptsSpanishSource,
    loop: loopSpanishSource,
    protocol: protocolSpanishSource,
    capabilities: capabilitiesSpanishSource,
    setup: setupSpanishSource,
    console: consoleSpanishSource,
    skills: skillsSpanishSource,
    firmware: firmwareSpanishSource,
  },
  en: {
    purpose: purposeEnglishSource,
    concepts: conceptsEnglishSource,
    loop: loopEnglishSource,
    protocol: protocolEnglishSource,
    capabilities: capabilitiesEnglishSource,
    setup: setupEnglishSource,
    console: consoleEnglishSource,
    skills: skillsEnglishSource,
    firmware: firmwareEnglishSource,
  },
};
