import { describe, expect, it } from 'bun:test';

import {
  cycleDeskSpeechMode,
  migrateLegacySpeechModeId,
  resolveDeskSpeechMode,
} from '@/persona/catalog';

describe('speech mode catalog', () => {
  it('falls back to default for unknown id', () => {
    expect(resolveDeskSpeechMode('missing').id).toBe('default');
  });

  it('migrates legacy seco to default', () => {
    expect(migrateLegacySpeechModeId('seco')).toBe('default');
    expect(migrateLegacySpeechModeId('default')).toBe('default');
    expect(migrateLegacySpeechModeId('nerd')).toBe('nerd');
    expect(migrateLegacySpeechModeId('nope')).toBe('default');
  });

  it('cycles default → nerd → gracioso → warm → default', () => {
    expect(cycleDeskSpeechMode('default', 1).id).toBe('nerd');
    expect(cycleDeskSpeechMode('nerd', 1).id).toBe('gracioso');
    expect(cycleDeskSpeechMode('gracioso', 1).id).toBe('warm');
    expect(cycleDeskSpeechMode('warm', 1).id).toBe('default');
    expect(cycleDeskSpeechMode('default', -1).id).toBe('warm');
  });
});
