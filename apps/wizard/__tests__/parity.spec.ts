import { describe, expect, it } from 'bun:test';

import { parseDevelopmentVariableMap as parseWithBootstrapParser } from '../generator/assets/scripts/vars';
import { parseDevelopmentVariableMap as parseWithWizardParser } from '../src/vars';

// The wizard writes .dev.vars and bootstrap reads it back with a separate
// copy of the parser (different source trees, both shipped into the starter).
// This pins the two implementations to identical behavior.
const trickyFixtureContent = [
  'DEVICE_SHARED_SECRET=dev-change-me',
  'OPENROUTER_API_KEY=',
  'MOCK_VOICE=1',
  'APOLLO_OWNER_EMAIL=owner@example.com',
  'GITHUB_APP_PRIVATE_KEY="first line\\nsecond line\\nthird line"',
  'TRAILING_SPACES=  padded value  ',
  'WITH_EQUALS=a=b=c',
  '# COMMENTED=never',
  '=no-name',
  'not a variable line',
].join('\n');

describe('dev-vars parser parity (wizard vs bootstrap)', () => {
  it('parses the same fixture identically', () => {
    const wizardResult = parseWithWizardParser(trickyFixtureContent);
    const bootstrapResult = parseWithBootstrapParser(trickyFixtureContent);
    expect([...wizardResult.entries()]).toEqual([...bootstrapResult.entries()]);
    expect(wizardResult.get('WITH_EQUALS')).toBe('a=b=c');
    expect(wizardResult.get('GITHUB_APP_PRIVATE_KEY')).toContain('\nsecond line\n');
    expect(wizardResult.has('# COMMENTED')).toBe(false);
  });
});
