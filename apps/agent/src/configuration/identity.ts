// The owner seam: every non-secret value that makes a deployment personal
// lives in this one file, so pointing Apollo at a new owner is a single edit
// here plus `wrangler secret put` for the credentials.

// ElevenLabs voice id. eleven_multilingual_v2 takes no language_code, so the
// Rioplatense accent has to live in the voice itself: pick one from the Voice
// Library (Spanish / Argentina, e.g. Malena or Tomás), add it to My Voices,
// and paste its id here.
export const APOLLO_TTS_VOICE = 'ByVRQtaK1WDOvTmP1PKO';

export const APOLLO_TIME_ZONE = 'America/Argentina/Buenos_Aires';

export const APOLLO_TIME_ZONE_SPOKEN_LABEL = 'hora de Buenos Aires';

export const DEFAULT_DESK_WEATHER_LOCATION = {
  latitude: -34.6037,
  longitude: -58.3816,
  locationLabel: 'Buenos Aires',
  timezone: APOLLO_TIME_ZONE,
} as const;

// Resend's sandbox sender only delivers to the Resend account owner's own
// address — exactly Apollo's use case (reports and notes to the owner, never
// arbitrary recipients). Swap for a verified-domain sender to lift that limit.
export const APOLLO_EMAIL_SENDER = 'Apollo <onboarding@resend.dev>';
