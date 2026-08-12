// The model has no clock: without this note it guesses dates from training
// data — wrong answers to "qué hora es", relative dates, and stale search
// queries. Every turn stamps the prompt with the current wall time.
export const APOLLO_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export function formatCurrentDateTimeForPrompt(nowMilliseconds: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: APOLLO_TIME_ZONE,
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(nowMilliseconds));
}

export function buildCurrentTimePromptNote(nowMilliseconds: number): string {
  return (
    `\n\nFecha y hora actual: ${formatCurrentDateTimeForPrompt(nowMilliseconds)} (hora de Buenos Aires). ` +
    'Usala para responder qué hora o día es, resolver fechas relativas, y armar búsquedas web actuales.'
  );
}
