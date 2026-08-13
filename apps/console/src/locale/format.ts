import type { Locale } from '@/locale/detect';

export function formatAbsoluteTimestamp(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatCalendarDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date);
}

export function formatClockTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatDayTimestamp(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

const MINUTE_IN_MILLISECONDS = 60_000;

export function formatRemainingDuration(milliseconds: number, locale: Locale): string {
  const relativeTimeFormatter = new Intl.RelativeTimeFormat(locale, {
    style: 'narrow',
    numeric: 'always',
  });
  const remainingMinutes = Math.round(milliseconds / MINUTE_IN_MILLISECONDS);
  if (remainingMinutes < 90) {
    return relativeTimeFormatter.format(remainingMinutes, 'minute');
  }
  if (remainingMinutes < 48 * 60) {
    return relativeTimeFormatter.format(Math.round(remainingMinutes / 60), 'hour');
  }
  return relativeTimeFormatter.format(Math.round(remainingMinutes / (24 * 60)), 'day');
}
