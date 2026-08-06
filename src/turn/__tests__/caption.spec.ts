import { describe, expect, it } from 'bun:test';

import { mapToolNameToThinkingCaption } from '@/turn/caption';

describe('mapToolNameToThinkingCaption', () => {
  it('maps known tools', () => {
    expect(mapToolNameToThinkingCaption('weather_now')).toBe('Consultando clima…');
    expect(mapToolNameToThinkingCaption('set_weather_location')).toBe(
      'Guardando ubicación…',
    );
    expect(mapToolNameToThinkingCaption('web_search')).toBe('Buscando…');
    expect(mapToolNameToThinkingCaption('start_research')).toBe('Investigando…');
    expect(mapToolNameToThinkingCaption('recall_memory')).toBe('Recordando…');
    expect(mapToolNameToThinkingCaption('translate')).toBe('Traduciendo…');
    expect(mapToolNameToThinkingCaption('remember_fact')).toBe('Guardando…');
    expect(mapToolNameToThinkingCaption('set_reminder')).toBe('Recordatorios…');
    expect(mapToolNameToThinkingCaption('list_reminders')).toBe('Recordatorios…');
    expect(mapToolNameToThinkingCaption('cancel_reminder')).toBe('Recordatorios…');
    expect(mapToolNameToThinkingCaption('set_focus')).toBe('Focus…');
    expect(mapToolNameToThinkingCaption('clear_focus')).toBe('Focus…');
    expect(mapToolNameToThinkingCaption('sandbox_run_code')).toBe('Ejecutando…');
    expect(mapToolNameToThinkingCaption('sandbox_exec')).toBe('Ejecutando…');
  });

  it('falls back for unknown tools', () => {
    expect(mapToolNameToThinkingCaption('weird_tool')).toBe('Trabajando…');
  });
});
