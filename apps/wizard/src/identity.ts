export type DeskWeatherIdentityLocation = {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationLabel: string;
  readonly timezone: string;
};

// Values are interpolated into single-quoted TypeScript literals, so a city
// like L'Hospitalet must arrive escaped or the rewritten file stops parsing.
function escapeForSingleQuotedLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

// Matches a single-quoted literal whose content may contain escaped quotes,
// so a rewrite stays re-runnable on its own output.
const QUOTED_LITERAL_PATTERN_TEXT = String.raw`'(?:[^'\\]|\\.)*'`;

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
  return fileContent.replace(anchorPattern, () => replacementText);
}

export function rewriteTtsVoiceId(fileContent: string, voiceId: string): string {
  return replaceAnchoredPattern(
    fileContent,
    new RegExp(`export const APOLLO_TTS_VOICE = ${QUOTED_LITERAL_PATTERN_TEXT};`),
    `export const APOLLO_TTS_VOICE = '${escapeForSingleQuotedLiteral(voiceId)}';`,
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
    new RegExp(`export const APOLLO_TIME_ZONE = ${QUOTED_LITERAL_PATTERN_TEXT};`),
    `export const APOLLO_TIME_ZONE = '${escapeForSingleQuotedLiteral(timezone)}';`,
    'APOLLO_TIME_ZONE',
  );
  return replaceAnchoredPattern(
    withTimezone,
    new RegExp(
      `export const APOLLO_TIME_ZONE_SPOKEN_LABEL = ${QUOTED_LITERAL_PATTERN_TEXT};`,
    ),
    `export const APOLLO_TIME_ZONE_SPOKEN_LABEL = '${escapeForSingleQuotedLiteral(spokenLabel)}';`,
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
      `  locationLabel: '${escapeForSingleQuotedLiteral(location.locationLabel)}',`,
      `  timezone: '${escapeForSingleQuotedLiteral(location.timezone)}',`,
      '} as const;',
    ].join('\n'),
    'DEFAULT_DESK_WEATHER_LOCATION',
  );
}

export type DeskHomeIdentity = {
  readonly locationLabel: string;
  readonly timezone: string;
};

function unescapeSingleQuotedLiteral(quotedLiteralText: string): string {
  return quotedLiteralText.slice(1, -1).replace(/\\(.)/g, '$1');
}

export function readCurrentHomeLocation(
  fileContent: string,
): DeskHomeIdentity | undefined {
  const locationBlockText = fileContent.match(
    /export const DEFAULT_DESK_WEATHER_LOCATION = \{[^}]*\} as const;/,
  )?.[0];
  if (locationBlockText === undefined) {
    return undefined;
  }
  const labelLiteral = locationBlockText.match(
    new RegExp(`locationLabel: (${QUOTED_LITERAL_PATTERN_TEXT}),`),
  )?.[1];
  // The shipped block references APOLLO_TIME_ZONE by identifier until the
  // first rewrite inlines a literal, so fall back to the constant itself.
  const timezoneLiteral =
    locationBlockText.match(
      new RegExp(`timezone: (${QUOTED_LITERAL_PATTERN_TEXT}),`),
    )?.[1] ??
    fileContent.match(
      new RegExp(`export const APOLLO_TIME_ZONE = (${QUOTED_LITERAL_PATTERN_TEXT});`),
    )?.[1];
  if (labelLiteral === undefined || timezoneLiteral === undefined) {
    return undefined;
  }
  return {
    locationLabel: unescapeSingleQuotedLiteral(labelLiteral),
    timezone: unescapeSingleQuotedLiteral(timezoneLiteral),
  };
}

export function readCurrentTtsVoiceId(fileContent: string): string | undefined {
  return fileContent
    .match(
      new RegExp(`export const APOLLO_TTS_VOICE = (${QUOTED_LITERAL_PATTERN_TEXT});`),
    )?.[1]
    ?.slice(1, -1);
}
