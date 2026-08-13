import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

import {
  readCurrentTtsVoiceId,
  rewriteTimeZone,
  rewriteTtsVoiceId,
  rewriteWeatherLocation,
} from '@/identity';

// The rewriters must keep working against the identity file the starter
// generator actually ships: the agent's file with the voice id placeholdered.
async function readGeneratedShapeIdentityContent(): Promise<string> {
  const agentIdentityContent = await Bun.file(
    join(
      import.meta.dir,
      '..',
      '..',
      '..',
      'agent',
      'src',
      'configuration',
      'identity.ts',
    ),
  ).text();
  return agentIdentityContent.replace(
    /export const APOLLO_TTS_VOICE = '[^']*';/,
    "export const APOLLO_TTS_VOICE = '';",
  );
}

describe('identity rewriters against the shipped file shape', () => {
  it('fills the voice id placeholder and reads it back', async () => {
    const identityContent = await readGeneratedShapeIdentityContent();
    expect(readCurrentTtsVoiceId(identityContent)).toBe('');
    const rewrittenContent = rewriteTtsVoiceId(identityContent, 'voice-123');
    expect(readCurrentTtsVoiceId(rewrittenContent)).toBe('voice-123');
  });

  it('rewrites the timezone pair', async () => {
    const identityContent = await readGeneratedShapeIdentityContent();
    const rewrittenContent = rewriteTimeZone(
      identityContent,
      'Europe/Madrid',
      'hora de Madrid',
    );
    expect(rewrittenContent).toContain(
      "export const APOLLO_TIME_ZONE = 'Europe/Madrid';",
    );
    expect(rewrittenContent).toContain(
      "export const APOLLO_TIME_ZONE_SPOKEN_LABEL = 'hora de Madrid';",
    );
  });

  it('rewrites the whole weather location block', async () => {
    const identityContent = await readGeneratedShapeIdentityContent();
    const rewrittenContent = rewriteWeatherLocation(identityContent, {
      latitude: 40.4168,
      longitude: -3.7038,
      locationLabel: 'Madrid',
      timezone: 'Europe/Madrid',
    });
    expect(rewrittenContent).toContain('latitude: 40.4168,');
    expect(rewrittenContent).toContain("locationLabel: 'Madrid',");
    expect(rewrittenContent).toContain("timezone: 'Europe/Madrid',");
    expect(rewrittenContent).not.toContain("locationLabel: 'Buenos Aires',");
  });

  it('throws loudly when an anchor is missing', () => {
    expect(() => rewriteTtsVoiceId('const somethingElse = 1;', 'voice-123')).toThrow(
      /identity anchor missing/,
    );
  });
});
