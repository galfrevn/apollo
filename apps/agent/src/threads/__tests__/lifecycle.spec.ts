import { describe, expect, it } from 'bun:test';

import {
  buildDefaultThreadTitle,
  decideThreadRotation,
  parseStoredLastTurnAt,
  THREAD_INACTIVITY_CUTOFF_MILLISECONDS,
} from '@/threads/lifecycle';

describe('decideThreadRotation', () => {
  it('starts a first thread when none is active', () => {
    const decision = decideThreadRotation({
      activeSessionId: null,
      lastTurnAtMilliseconds: null,
      nowMilliseconds: 1_000,
    });

    expect(decision).toEqual({ action: 'start', previousSessionId: null });
  });

  it('reuses the active thread inside the inactivity window', () => {
    const decision = decideThreadRotation({
      activeSessionId: 'thread-1',
      lastTurnAtMilliseconds: 1_000,
      nowMilliseconds: 1_000 + THREAD_INACTIVITY_CUTOFF_MILLISECONDS - 1,
    });

    expect(decision).toEqual({ action: 'reuse', sessionId: 'thread-1' });
  });

  it('starts a new thread once the cutoff elapses, handing off the previous one', () => {
    const decision = decideThreadRotation({
      activeSessionId: 'thread-1',
      lastTurnAtMilliseconds: 1_000,
      nowMilliseconds: 1_000 + THREAD_INACTIVITY_CUTOFF_MILLISECONDS,
    });

    expect(decision).toEqual({ action: 'start', previousSessionId: 'thread-1' });
  });

  it('reuses the active thread when the last turn timestamp is unknown', () => {
    const decision = decideThreadRotation({
      activeSessionId: 'thread-1',
      lastTurnAtMilliseconds: null,
      nowMilliseconds: 999_999_999,
    });

    expect(decision).toEqual({ action: 'reuse', sessionId: 'thread-1' });
  });

  it('honors a custom cutoff', () => {
    const decision = decideThreadRotation({
      activeSessionId: 'thread-1',
      lastTurnAtMilliseconds: 0,
      nowMilliseconds: 5_000,
      inactivityCutoffMilliseconds: 4_000,
    });

    expect(decision).toEqual({ action: 'start', previousSessionId: 'thread-1' });
  });
});

describe('parseStoredLastTurnAt', () => {
  it('parses a stored millisecond timestamp', () => {
    expect(parseStoredLastTurnAt('1723459200000')).toBe(1_723_459_200_000);
  });

  it('treats null, empty, and garbage values as unknown', () => {
    expect(parseStoredLastTurnAt(null)).toBeNull();
    expect(parseStoredLastTurnAt('')).toBeNull();
    expect(parseStoredLastTurnAt('ayer')).toBeNull();
  });
});

describe('buildDefaultThreadTitle', () => {
  it('names the thread after its calendar day', () => {
    expect(buildDefaultThreadTitle(Date.UTC(2026, 7, 12, 15, 30))).toBe(
      'Conversación del 2026-08-12',
    );
  });
});
