import { describe, expect, it } from 'bun:test';

import {
  appendToWakeBuffer,
  isPartialWakePhrase,
  matchesWakePhrase,
  normalizeWakeCharacter,
} from '@/landing/wake';

function typePhrase(phrase: string): string {
  let buffer = '';
  for (const key of phrase) {
    buffer = appendToWakeBuffer(buffer, key);
  }
  return buffer;
}

describe('normalizeWakeCharacter', () => {
  it('lowercases plain letters', () => {
    expect(normalizeWakeCharacter('H')).toBe('h');
  });

  it('strips diacritics so the accented wake word matches', () => {
    expect(normalizeWakeCharacter('ó')).toBe('o');
  });

  it('rejects digits, punctuation, and named keys', () => {
    expect(normalizeWakeCharacter('4')).toBeNull();
    expect(normalizeWakeCharacter(',')).toBeNull();
    expect(normalizeWakeCharacter('Shift')).toBeNull();
    expect(normalizeWakeCharacter(' ')).toBeNull();
  });
});

describe('matchesWakePhrase', () => {
  it('detects the phrase typed with spaces and punctuation', () => {
    expect(matchesWakePhrase(typePhrase('Hey, Apólo!'))).toBe(true);
  });

  it('detects the double-l spelling', () => {
    expect(matchesWakePhrase(typePhrase('hey apollo'))).toBe(true);
  });

  it('detects the phrase buried in earlier typing', () => {
    expect(matchesWakePhrase(typePhrase('lorem ipsum hey apolo'))).toBe(true);
  });

  it('ignores unrelated typing', () => {
    expect(matchesWakePhrase(typePhrase('hey there apollo fans, hello'))).toBe(false);
  });

  it('keeps the rolling buffer bounded', () => {
    expect(typePhrase('a'.repeat(200)).length).toBeLessThanOrEqual(24);
  });
});

describe('isPartialWakePhrase', () => {
  it('holds the space key while the wake word is being typed', () => {
    expect(isPartialWakePhrase(typePhrase('hey'))).toBe(true);
    expect(isPartialWakePhrase(typePhrase('reading along, hey'))).toBe(true);
  });

  it('lets the space key page the document during ordinary reading', () => {
    expect(isPartialWakePhrase(typePhrase('reading along'))).toBe(false);
    expect(isPartialWakePhrase('')).toBe(false);
  });
});
