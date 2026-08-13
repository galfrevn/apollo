import { describe, expect, it } from 'bun:test';

import {
  formatAbsoluteTimestamp,
  formatCalendarDate,
  formatClockTime,
  formatDayTimestamp,
  formatRemainingDuration,
} from '@/locale/format';

const SAMPLE_DATE = new Date('2026-08-13T15:30:00');

describe('formatAbsoluteTimestamp', () => {
  it('renders the Spanish month name', () => {
    expect(formatAbsoluteTimestamp(SAMPLE_DATE, 'es')).toContain('ago');
  });

  it('renders the English month name', () => {
    expect(formatAbsoluteTimestamp(SAMPLE_DATE, 'en')).toContain('Aug');
  });
});

describe('formatCalendarDate', () => {
  it('renders the year in both locales', () => {
    expect(formatCalendarDate(SAMPLE_DATE, 'es')).toContain('2026');
    expect(formatCalendarDate(SAMPLE_DATE, 'en')).toContain('2026');
  });
});

describe('formatClockTime', () => {
  it('renders minutes in both locales', () => {
    expect(formatClockTime(SAMPLE_DATE, 'es')).toContain('30');
    expect(formatClockTime(SAMPLE_DATE, 'en')).toContain('30');
  });
});

describe('formatDayTimestamp', () => {
  it('renders the day of the month in both locales', () => {
    expect(formatDayTimestamp(SAMPLE_DATE, 'es')).toContain('13');
    expect(formatDayTimestamp(SAMPLE_DATE, 'en')).toContain('13');
  });
});

describe('formatRemainingDuration', () => {
  const MINUTE = 60_000;

  it('formats minutes below the ninety-minute threshold', () => {
    expect(formatRemainingDuration(5 * MINUTE, 'en')).toContain('5');
    expect(formatRemainingDuration(5 * MINUTE, 'es')).toContain('5');
  });

  it('formats hours below the two-day threshold', () => {
    expect(formatRemainingDuration(3 * 60 * MINUTE, 'en')).toContain('3');
  });

  it('formats days beyond the two-day threshold', () => {
    expect(formatRemainingDuration(72 * 60 * MINUTE, 'en')).toContain('3');
  });

  it('speaks the future tense in Spanish', () => {
    expect(formatRemainingDuration(5 * MINUTE, 'es')).toContain('dentro de');
  });

  it('speaks the future tense in English', () => {
    expect(formatRemainingDuration(5 * MINUTE, 'en')).toContain('in');
  });
});
