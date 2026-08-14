import { SUPPORTED_LOCALE_LIST } from '@/locale/detect';

import type { Locale } from '@/locale/detect';

export interface DocsChapterDefinition {
  readonly slug: string;
  readonly titleMap: Record<Locale, string>;
  readonly descriptionMap: Record<Locale, string>;
}

export interface DocsPartDefinition {
  readonly titleMap: Record<Locale, string>;
  readonly chapterDefinitionList: readonly DocsChapterDefinition[];
}

export interface DocsChapterEntry {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly number: number;
  readonly partTitle: string;
}

export interface DocsPartEntry {
  readonly title: string;
  readonly chapterEntryList: readonly DocsChapterEntry[];
}

export const DOCS_PART_DEFINITION_LIST: readonly DocsPartDefinition[] = [
  {
    titleMap: { es: 'Parte I — Introducción', en: 'Part I — Introduction' },
    chapterDefinitionList: [
      {
        slug: 'purpose',
        titleMap: { es: 'Propósito', en: 'Purpose' },
        descriptionMap: {
          es: 'Qué es Apollo, qué no es y quién debería correrlo.',
          en: 'What Apollo is, what it is not, and who should run it.',
        },
      },
      {
        slug: 'concepts',
        titleMap: { es: 'Conceptos', en: 'Concepts' },
        descriptionMap: {
          es: 'Escritorio, turno, sesión y herramienta: las cuatro palabras que el resto asume.',
          en: 'The four words the rest of the handbook assumes: desk, turn, session, tool.',
        },
      },
    ],
  },
  {
    titleMap: { es: 'Parte II — Ejecución', en: 'Part II — Runtime' },
    chapterDefinitionList: [
      {
        slug: 'loop',
        titleMap: { es: 'Ciclo', en: 'Loop' },
        descriptionMap: {
          es: 'De la palabra de activación a la respuesta hablada, paso a paso.',
          en: 'From wake word to spoken reply, step by step.',
        },
      },
      {
        slug: 'protocol',
        titleMap: { es: 'Protocolo', en: 'Protocol' },
        descriptionMap: {
          es: 'Cada mensaje que cruza entre el dispositivo y el worker.',
          en: 'Every message on the wire between the device and the worker.',
        },
      },
    ],
  },
  {
    titleMap: { es: 'Parte III — Capacidades', en: 'Part III — Capabilities' },
    chapterDefinitionList: [
      {
        slug: 'capabilities',
        titleMap: { es: 'Capacidades', en: 'Capabilities' },
        descriptionMap: {
          es: 'El catálogo de herramientas, la regla de seguridad y cómo sumar las tuyas.',
          en: 'The tool catalog, the safety rule, and how to add your own.',
        },
      },
    ],
  },
  {
    titleMap: { es: 'Parte IV — Operación', en: 'Part IV — Operations' },
    chapterDefinitionList: [
      {
        slug: 'setup',
        titleMap: { es: 'Instalación', en: 'Setup' },
        descriptionMap: {
          es: 'Un comando hasta un worker desplegado y un dispositivo verificado.',
          en: 'One command to a deployed worker and a verified device.',
        },
      },
      {
        slug: 'console',
        titleMap: { es: 'Consola', en: 'Console' },
        descriptionMap: {
          es: 'Opera un despliegue desde el navegador.',
          en: 'Run a deployment from the browser.',
        },
      },
      {
        slug: 'skills',
        titleMap: { es: 'Skills', en: 'Skills' },
        descriptionMap: {
          es: 'Entrégale el manual a tu agente de código.',
          en: 'Hand the manual to your coding agent.',
        },
      },
    ],
  },
  {
    titleMap: { es: 'Parte V — Cuerpo', en: 'Part V — Body' },
    chapterDefinitionList: [
      {
        slug: 'firmware',
        titleMap: { es: 'Firmware', en: 'Firmware' },
        descriptionMap: {
          es: 'Compila, flashea y apunta un cuerpo a tu cerebro.',
          en: 'Build, flash, and point a body at your brain.',
        },
      },
    ],
  },
];

export const DOCS_CHAPTER_SLUG_LIST: readonly string[] =
  DOCS_PART_DEFINITION_LIST.flatMap((partDefinition) =>
    partDefinition.chapterDefinitionList.map(
      (chapterDefinition) => chapterDefinition.slug,
    ),
  );

function buildPartEntryList(locale: Locale): readonly DocsPartEntry[] {
  let assignedChapterCount = 0;
  return DOCS_PART_DEFINITION_LIST.map((partDefinition) => {
    const partTitle = partDefinition.titleMap[locale];
    return {
      title: partTitle,
      chapterEntryList: partDefinition.chapterDefinitionList.map((chapterDefinition) => {
        assignedChapterCount += 1;
        return {
          slug: chapterDefinition.slug,
          title: chapterDefinition.titleMap[locale],
          description: chapterDefinition.descriptionMap[locale],
          number: assignedChapterCount,
          partTitle,
        };
      }),
    };
  });
}

function buildLocaleKeyedRecord<ValueShape>(
  buildValue: (locale: Locale) => ValueShape,
): Record<Locale, ValueShape> {
  const record = {} as Record<Locale, ValueShape>;
  for (const locale of SUPPORTED_LOCALE_LIST) {
    record[locale] = buildValue(locale);
  }
  return record;
}

export const DOCS_PART_LIST_MAP: Record<Locale, readonly DocsPartEntry[]> =
  buildLocaleKeyedRecord(buildPartEntryList);

export const DOCS_CHAPTER_LIST_MAP: Record<Locale, readonly DocsChapterEntry[]> =
  buildLocaleKeyedRecord((locale) =>
    DOCS_PART_LIST_MAP[locale].flatMap((partEntry) => partEntry.chapterEntryList),
  );

export function findDocsChapterBySlug(
  slug: string,
  locale: Locale,
): DocsChapterEntry | null {
  return (
    DOCS_CHAPTER_LIST_MAP[locale].find((chapterEntry) => chapterEntry.slug === slug) ??
    null
  );
}

export function isDocsChapterSlug(candidate: string): boolean {
  return DOCS_CHAPTER_SLUG_LIST.includes(candidate);
}

export function formatDocsChapterNumber(chapterNumber: number): string {
  return String(chapterNumber).padStart(2, '0');
}
