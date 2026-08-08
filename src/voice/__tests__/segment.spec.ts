import { describe, expect, it } from 'bun:test';

import {
  SPEECH_SEGMENT_MAX_CHARACTER_COUNT,
  splitTextIntoSpeechSegmentList,
} from '@/voice/segment';

describe('splitTextIntoSpeechSegmentList', () => {
  it('returns nothing for empty or whitespace-only text', () => {
    expect(splitTextIntoSpeechSegmentList('')).toEqual([]);
    expect(splitTextIntoSpeechSegmentList('   \n ')).toEqual([]);
  });

  it('keeps a short reply as a single segment', () => {
    expect(splitTextIntoSpeechSegmentList('Mañana llueve. Llevá paraguas.')).toEqual([
      'Mañana llueve. Llevá paraguas.',
    ]);
  });

  it('splits on sentence boundaries without losing any content', () => {
    const sentence = 'Esta es una oración de prueba que ocupa unos cuantos caracteres.';
    const text = Array.from({ length: 12 }, () => sentence).join(' ');

    const segmentList = splitTextIntoSpeechSegmentList(text);

    expect(segmentList.length).toBeGreaterThan(1);
    for (const segment of segmentList) {
      expect(segment.length).toBeLessThanOrEqual(SPEECH_SEGMENT_MAX_CHARACTER_COUNT);
      // Segments end on sentence boundaries, not mid-word.
      expect(segment.endsWith('.')).toBe(true);
    }
    expect(segmentList.join(' ').replaceAll(/\s+/g, ' ')).toBe(
      text.replaceAll(/\s+/g, ' '),
    );
  });

  it('falls back to comma or space cuts for a single run-on sentence', () => {
    const runOnSentence = `${'palabra '.repeat(80)}final`;

    const segmentList = splitTextIntoSpeechSegmentList(runOnSentence);

    expect(segmentList.length).toBeGreaterThan(1);
    for (const segment of segmentList) {
      expect(segment.length).toBeLessThanOrEqual(SPEECH_SEGMENT_MAX_CHARACTER_COUNT);
    }
    expect(segmentList.join(' ').replaceAll(/\s+/g, ' ')).toBe(
      runOnSentence.replaceAll(/\s+/g, ' '),
    );
  });

  it('honors a custom maximum, packing whole sentences while they fit', () => {
    const segmentList = splitTextIntoSpeechSegmentList('Hola. Chau. Nos vemos.', 12);
    expect(segmentList).toEqual(['Hola. Chau.', 'Nos vemos.']);
  });
});
