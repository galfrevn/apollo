const toolNameToThinkingCaptionMap: Readonly<Record<string, string>> = {
  weather_now: 'Consultando clima…',
  set_weather_location: 'Guardando ubicación…',
  web_search: 'Buscando…',
  start_research: 'Investigando…',
  recall_memory: 'Recordando…',
  translate: 'Traduciendo…',
  remember_fact: 'Guardando…',
  set_reminder: 'Recordatorios…',
  list_reminders: 'Recordatorios…',
  cancel_reminder: 'Recordatorios…',
  set_focus: 'Focus…',
  clear_focus: 'Focus…',
  sandbox_run_code: 'Ejecutando…',
  sandbox_exec: 'Ejecutando…',
};

export function mapToolNameToThinkingCaption(toolName: string): string {
  return toolNameToThinkingCaptionMap[toolName] ?? 'Trabajando…';
}
