import { describe, expect, it } from 'bun:test';

import {
  advanceWakeWord,
  appendToWakeBuffer,
  isWakePhrasePrefix,
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

function typeWord(keyList: readonly string[]): string {
  let currentWord = '';
  for (const key of keyList) {
    currentWord = advanceWakeWord(currentWord, key);
  }
  return currentWord;
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

describe('isWakePhrasePrefix', () => {
  it('holds the space key while the wake word is being typed', () => {
    expect(isWakePhrasePrefix('h')).toBe(true);
    expect(isWakePhrasePrefix('hey')).toBe(true);
    expect(isWakePhrasePrefix('heyapol')).toBe(true);
  });

  it('lets the space key page the document during ordinary reading', () => {
    expect(isWakePhrasePrefix('')).toBe(false);
    expect(isWakePhrasePrefix('along')).toBe(false);
  });

  it('does not treat a word merely ending in a wake prefix as one', () => {
    for (const ordinaryWord of ['with', 'they', 'each', 'such', 'the']) {
      expect(isWakePhrasePrefix(ordinaryWord)).toBe(false);
    }
  });
});

describe('advanceWakeWord', () => {
  it('keeps the prefix alive across the comma of the punctuated phrase', () => {
    expect(typeWord(['H', 'e', 'y', ','])).toBe('hey');
    expect(isWakePhrasePrefix(typeWord(['H', 'e', 'y', ',']))).toBe(true);
  });

  it('ends the word on every key that is not typed into the phrase', () => {
    for (const breakingKey of [
      'Shift',
      'CapsLock',
      'Backspace',
      'Enter',
      'Tab',
      'Escape',
      'ArrowLeft',
      ' ',
      '4',
    ]) {
      expect(typeWord(['h', 'e', 'y', breakingKey])).toBe('');
    }
  });

  it('ends the word on punctuation that follows ordinary reading', () => {
    expect(typeWord(['w', 'h', 'i', 'c', 'h', ','])).toBe('');
  });
});
