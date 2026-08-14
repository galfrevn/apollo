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
  it('renders the English month name', () => {
    expect(formatAbsoluteTimestamp(SAMPLE_DATE)).toContain('Aug');
  });
});

describe('formatCalendarDate', () => {
  it('renders the year', () => {
    expect(formatCalendarDate(SAMPLE_DATE)).toContain('2026');
  });
});

describe('formatClockTime', () => {
  it('renders minutes', () => {
    expect(formatClockTime(SAMPLE_DATE)).toContain('30');
  });
});

describe('formatDayTimestamp', () => {
  it('renders the day of the month', () => {
    expect(formatDayTimestamp(SAMPLE_DATE)).toContain('13');
  });
});

describe('formatRemainingDuration', () => {
  const MINUTE = 60_000;

  it('formats minutes below the ninety-minute threshold', () => {
    expect(formatRemainingDuration(5 * MINUTE)).toContain('5');
  });

  it('formats hours below the two-day threshold', () => {
    expect(formatRemainingDuration(3 * 60 * MINUTE)).toContain('3');
  });

  it('formats days beyond the two-day threshold', () => {
    expect(formatRemainingDuration(72 * 60 * MINUTE)).toContain('3');
  });

  it('speaks the future tense', () => {
    expect(formatRemainingDuration(5 * MINUTE)).toContain('in');
  });
});
