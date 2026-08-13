export type DeskWeatherIdentityLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationLabel: string;
  readonly timezone: string;
};

// Every rewrite is anchored to the exact shape the starter generator ships.
// A miss means the file was hand-edited, and silently skipping would deploy a
// half-applied identity — so every miss throws with a manual-edit hint.
function replaceAnchoredPattern(
  fileContent: string,
  anchorPattern: RegExp,
  replacementText: string,
  anchorLabel: string,
): string {
  if (!anchorPattern.test(fileContent)) {
    throw new Error(
      `identity anchor missing (${anchorLabel}) — src/configuration/identity.ts was edited by hand; apply the change there directly`,
    );
  }
  return fileContent.replace(anchorPattern, replacementText);
}

export function rewriteTtsVoiceId(fileContent: string, voiceId: string): string {
  return replaceAnchoredPattern(
    fileContent,
    /export const APOLLO_TTS_VOICE = '[^']*';/,
    `export const APOLLO_TTS_VOICE = '${voiceId}';`,
    'APOLLO_TTS_VOICE',
  );
}

export function rewriteTimeZone(
  fileContent: string,
  timezone: string,
  spokenLabel: string,
): string {
  const withTimezone = replaceAnchoredPattern(
    fileContent,
    /export const APOLLO_TIME_ZONE = '[^']*';/,
    `export const APOLLO_TIME_ZONE = '${timezone}';`,
    'APOLLO_TIME_ZONE',
  );
  return replaceAnchoredPattern(
    withTimezone,
    /export const APOLLO_TIME_ZONE_SPOKEN_LABEL = '[^']*';/,
    `export const APOLLO_TIME_ZONE_SPOKEN_LABEL = '${spokenLabel}';`,
    'APOLLO_TIME_ZONE_SPOKEN_LABEL',
  );
}

export function rewriteWeatherLocation(
  fileContent: string,
  location: DeskWeatherIdentityLocation,
): string {
  return replaceAnchoredPattern(
    fileContent,
    /export const DEFAULT_DESK_WEATHER_LOCATION = \{[^}]*\} as const;/,
    [
      'export const DEFAULT_DESK_WEATHER_LOCATION = {',
      `  latitude: ${location.latitude},`,
      `  longitude: ${location.longitude},`,
      `  locationLabel: '${location.locationLabel}',`,
      `  timezone: '${location.timezone}',`,
      '} as const;',
    ].join('\n'),
    'DEFAULT_DESK_WEATHER_LOCATION',
  );
}

export function readCurrentTtsVoiceId(fileContent: string): string | undefined {
  return fileContent.match(/export const APOLLO_TTS_VOICE = '([^']*)';/)?.[1];
}
