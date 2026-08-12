import { describe, expect, it } from 'bun:test';

import {
  buildExtractionRetryMessageList,
  buildMemoryExtractionMessageList,
  flattenRecentHistoryToTranscript,
  mergeOwnerFacts,
  OWNER_MEMORY_BLOCK_MAX_CHARACTERS,
  OWNER_MEMORY_MAX_FACT_COUNT,
  OWNER_MEMORY_STALE_FACT_WINDOW_MS,
  parseMemoryExtractionResult,
  parseStoredMemoryIndexIntentList,
  parseStoredOwnerMemoryState,
  renderOwnerMemoryBlock,
  seedOwnerFactsFromMemoryBlock,
  type MemoryExtractionResult,
  type OwnerFact,
} from '@/memory/consolidate';

const NOW_MILLISECONDS = 1_786_540_000_000;

function createFact(overrides: Partial<OwnerFact> = {}): OwnerFact {
  return {
    id: 'fact-1',
    content: 'Toma mate amargo',
    category: 'preference',
    lastConfirmedAtMilliseconds: NOW_MILLISECONDS,
    sourceCount: 1,
    ...overrides,
  };
}

function createExtraction(
  overrides: Partial<MemoryExtractionResult> = {},
): MemoryExtractionResult {
  return {
    newFactList: [],
    reinforcedFactIdList: [],
    staleFactIdList: [],
    ...overrides,
  };
}

function createSequentialIdentifierFactory(): () => string {
  let nextIdentifierNumber = 0;
  return () => {
    nextIdentifierNumber += 1;
    return `generated-${nextIdentifierNumber}`;
  };
}

describe('flattenRecentHistoryToTranscript', () => {
  it('labels speakers and joins text parts', () => {
    const transcript = flattenRecentHistoryToTranscript([
      { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hola' }] },
      {
        id: '2',
        role: 'assistant',
        parts: [{ type: 'text', text: '¿Cómo andás?' }],
      },
    ]);
    expect(transcript).toBe('Usuario: Hola\nApollo: ¿Cómo andás?');
  });

  it('skips messages without spoken text', () => {
    const transcript = flattenRecentHistoryToTranscript([
      { id: '1', role: 'user', parts: [{ type: 'tool-call', toolName: 'set_timer' }] },
      { id: '2', role: 'user', parts: [{ type: 'text', text: 'Poné un timer' }] },
    ]);
    expect(transcript).toBe('Usuario: Poné un timer');
  });
});

describe('parseMemoryExtractionResult', () => {
  const validExtractionJson = JSON.stringify(
    createExtraction({
      newFactList: [{ content: 'Trabaja en Apollo', category: 'context' }],
    }),
  );

  it('parses clean json', () => {
    const extraction = parseMemoryExtractionResult(validExtractionJson);
    expect(extraction?.newFactList).toHaveLength(1);
  });

  it('parses json wrapped in a fence', () => {
    const extraction = parseMemoryExtractionResult(
      '```json\n' + validExtractionJson + '\n```',
    );
    expect(extraction?.newFactList).toHaveLength(1);
  });

  it('parses json wrapped in prose', () => {
    const extraction = parseMemoryExtractionResult(
      `Acá está el resultado:\n${validExtractionJson}\nEspero que sirva.`,
    );
    expect(extraction?.newFactList).toHaveLength(1);
  });

  it('rejects text without json', () => {
    expect(parseMemoryExtractionResult('no hay nada acá')).toBeUndefined();
  });

  it('rejects json with the wrong shape', () => {
    expect(parseMemoryExtractionResult('{"newFactList": "no"}')).toBeUndefined();
  });
});

describe('buildMemoryExtractionMessageList', () => {
  it('lists existing facts with ids for the model to reference', () => {
    const messageList = buildMemoryExtractionMessageList({
      transcriptText: 'Usuario: Hola',
      existingFactList: [createFact()],
      nowIso: '2026-08-12T06:00:00.000Z',
    });
    expect(messageList).toHaveLength(2);
    expect(messageList[1]?.content).toContain('fact-1: [preference] Toma mate amargo');
    expect(messageList[1]?.content).toContain('Usuario: Hola');
  });
});

describe('buildExtractionRetryMessageList', () => {
  it('appends the invalid response and a corrective instruction', () => {
    const originalMessageList = buildMemoryExtractionMessageList({
      transcriptText: 'Usuario: Hola',
      existingFactList: [],
      nowIso: '2026-08-12T06:00:00.000Z',
    });
    const retryMessageList = buildExtractionRetryMessageList(
      originalMessageList,
      'respuesta inválida',
    );
    expect(retryMessageList).toHaveLength(4);
    expect(retryMessageList[2]).toEqual({
      role: 'assistant',
      content: 'respuesta inválida',
    });
    expect(retryMessageList[3]?.content).toContain('únicamente el JSON');
  });
});

describe('seedOwnerFactsFromMemoryBlock', () => {
  it('migrates legacy block lines into facts', () => {
    const seededFactList = seedOwnerFactsFromMemoryBlock({
      blockContent: '\n- Le gusta el rock nacional\n- Toma mate amargo',
      knownFactList: [createFact()],
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(seededFactList).toHaveLength(2);
    expect(seededFactList[1]?.content).toBe('Le gusta el rock nacional');
    expect(seededFactList[1]?.category).toBe('fact');
  });

  it('skips lines already known, ignoring case and trailing periods', () => {
    const seededFactList = seedOwnerFactsFromMemoryBlock({
      blockContent: '- toma mate amargo.',
      knownFactList: [createFact()],
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(seededFactList).toHaveLength(1);
  });

  it('ignores headers and blank lines', () => {
    const seededFactList = seedOwnerFactsFromMemoryBlock({
      blockContent: 'Preferencias:\n\n- Nueva preferencia',
      knownFactList: [],
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(seededFactList).toHaveLength(1);
    expect(seededFactList[0]?.content).toBe('Nueva preferencia');
  });
});

describe('mergeOwnerFacts', () => {
  it('adds new facts and reports them as genuinely new', () => {
    const merge = mergeOwnerFacts({
      existingFactList: [createFact()],
      extraction: createExtraction({
        newFactList: [
          { content: 'Tiene una gata que se llama Mora', category: 'relationship' },
        ],
      }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(2);
    expect(merge.genuinelyNewFactList).toHaveLength(1);
  });

  it('dedupes new facts against existing content', () => {
    const merge = mergeOwnerFacts({
      existingFactList: [createFact()],
      extraction: createExtraction({
        newFactList: [{ content: 'Toma mate amargo.', category: 'preference' }],
      }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(1);
    expect(merge.genuinelyNewFactList).toHaveLength(0);
  });

  it('reinforces referenced facts', () => {
    const staleConfirmedAt = NOW_MILLISECONDS - OWNER_MEMORY_STALE_FACT_WINDOW_MS;
    const merge = mergeOwnerFacts({
      existingFactList: [
        createFact({ lastConfirmedAtMilliseconds: staleConfirmedAt, sourceCount: 2 }),
      ],
      extraction: createExtraction({ reinforcedFactIdList: ['fact-1'] }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList[0]?.sourceCount).toBe(3);
    expect(merge.nextFactList[0]?.lastConfirmedAtMilliseconds).toBe(NOW_MILLISECONDS);
  });

  it('drops facts the extraction marked stale', () => {
    const merge = mergeOwnerFacts({
      existingFactList: [createFact()],
      extraction: createExtraction({ staleFactIdList: ['fact-1'] }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(0);
  });

  it('decays facts unconfirmed past the window', () => {
    const merge = mergeOwnerFacts({
      existingFactList: [
        createFact({
          lastConfirmedAtMilliseconds:
            NOW_MILLISECONDS - OWNER_MEMORY_STALE_FACT_WINDOW_MS - 1,
        }),
      ],
      extraction: createExtraction(),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(0);
  });

  it('keeps a reinforced fact that would otherwise decay', () => {
    const merge = mergeOwnerFacts({
      existingFactList: [
        createFact({
          lastConfirmedAtMilliseconds:
            NOW_MILLISECONDS - OWNER_MEMORY_STALE_FACT_WINDOW_MS - 1,
        }),
      ],
      extraction: createExtraction({ reinforcedFactIdList: ['fact-1'] }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(1);
  });

  it('caps the list evicting the weakest facts first', () => {
    const existingFactList = Array.from(
      { length: OWNER_MEMORY_MAX_FACT_COUNT },
      (_, factIndex) =>
        createFact({
          id: `existing-${factIndex}`,
          content: `Hecho número ${factIndex}`,
          sourceCount: 5,
        }),
    );
    const merge = mergeOwnerFacts({
      existingFactList,
      extraction: createExtraction({
        newFactList: [{ content: 'Hecho recién llegado', category: 'fact' }],
      }),
      nowMilliseconds: NOW_MILLISECONDS,
      createIdentifier: createSequentialIdentifierFactory(),
    });
    expect(merge.nextFactList).toHaveLength(OWNER_MEMORY_MAX_FACT_COUNT);
    // The newcomer has sourceCount 1 against a wall of 5s: it is the eviction
    // victim and must not be reported as genuinely new.
    expect(
      merge.nextFactList.some((fact) => fact.content === 'Hecho recién llegado'),
    ).toBe(false);
    expect(merge.genuinelyNewFactList).toHaveLength(0);
  });
});

describe('renderOwnerMemoryBlock', () => {
  it('groups facts under Spanish category headers', () => {
    const renderedBlock = renderOwnerMemoryBlock([
      createFact(),
      createFact({ id: 'fact-2', content: 'Trabaja en Apollo', category: 'context' }),
    ]);
    expect(renderedBlock).toBe(
      'Preferencias:\n- Toma mate amargo\n\nContexto actual:\n- Trabaja en Apollo',
    );
  });

  it('omits empty categories', () => {
    expect(renderOwnerMemoryBlock([createFact()])).not.toContain('Relaciones');
  });

  it('truncates on a line boundary at the character cap', () => {
    const longFactList = Array.from({ length: 100 }, (_, factIndex) =>
      createFact({
        id: `long-${factIndex}`,
        content: `Hecho ${factIndex} ${'relleno '.repeat(12)}`.trim(),
        category: 'fact',
      }),
    );
    const renderedBlock = renderOwnerMemoryBlock(longFactList);
    expect(renderedBlock.length).toBeLessThanOrEqual(OWNER_MEMORY_BLOCK_MAX_CHARACTERS);
    expect(renderedBlock.endsWith('\n')).toBe(false);
    for (const renderedLine of renderedBlock.split('\n')) {
      expect(
        renderedLine.startsWith('- ') ||
          renderedLine.endsWith(':') ||
          renderedLine === '',
      ).toBe(true);
    }
  });
});

describe('parseStoredMemoryIndexIntentList', () => {
  it('round-trips an intent list', () => {
    const intentList = [{ memoryId: 'memory-1', content: 'Toma mate amargo' }];
    expect(parseStoredMemoryIndexIntentList(JSON.stringify(intentList))).toEqual(
      intentList,
    );
    expect(parseStoredMemoryIndexIntentList('[]')).toEqual([]);
  });

  it('rejects garbage', () => {
    expect(parseStoredMemoryIndexIntentList('[{"memoryId":')).toBeUndefined();
    expect(parseStoredMemoryIndexIntentList('[{"memoryId":"x"}]')).toBeUndefined();
    expect(parseStoredMemoryIndexIntentList('null')).toBeUndefined();
  });
});

describe('parseStoredOwnerMemoryState', () => {
  it('round-trips a stored state', () => {
    const state = {
      factList: [createFact()],
      lastConsolidatedAtMilliseconds: NOW_MILLISECONDS,
      lastProcessedLeafId: 'leaf-1',
    };
    expect(parseStoredOwnerMemoryState(JSON.stringify(state))).toEqual(state);
  });

  it('rejects garbage', () => {
    expect(parseStoredOwnerMemoryState('{"factList":')).toBeUndefined();
    expect(parseStoredOwnerMemoryState('{"factList":[]}')).toBeUndefined();
    expect(parseStoredOwnerMemoryState('null')).toBeUndefined();
  });
});
