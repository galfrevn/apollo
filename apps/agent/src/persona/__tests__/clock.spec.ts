import { describe, expect, it } from 'bun:test';

import {
  buildCurrentTimePromptNote,
  formatCurrentDateTimeForPrompt,
} from '@/persona/clock';

describe('formatCurrentDateTimeForPrompt', () => {
  it('renders Buenos Aires local time in Spanish', () => {
    // 2026-08-08T15:30:00Z → 12:30 in Buenos Aires (UTC-3, no DST).
    const formatted = formatCurrentDateTimeForPrompt(Date.UTC(2026, 7, 8, 15, 30));
    expect(formatted).toContain('sábado');
    expect(formatted).toContain('8 de agosto de 2026');
    expect(formatted).toContain('12:30');
  });
});

describe('buildCurrentTimePromptNote', () => {
  it('embeds the formatted timestamp and usage guidance', () => {
    const note = buildCurrentTimePromptNote(Date.UTC(2026, 7, 8, 15, 30));
    expect(note).toContain('Fecha y hora actual:');
    expect(note).toContain('8 de agosto de 2026');
    expect(note).toContain('búsquedas web actuales');
  });
});
