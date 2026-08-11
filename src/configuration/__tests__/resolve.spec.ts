import { describe, expect, it } from 'bun:test';

import { defaultModelCatalog } from '@/configuration/models';
import { resolveApolloConfiguration } from '@/configuration/resolve';
import { createFakeApolloEnvironment } from '@/configuration/testing';

describe('resolveApolloConfiguration', () => {
  it('falls back to the default model catalog when nothing is set', () => {
    const configuration = resolveApolloConfiguration(createFakeApolloEnvironment());
    expect(configuration.models).toEqual(defaultModelCatalog);
  });

  it('prefers environment overrides over defaults', () => {
    const configuration = resolveApolloConfiguration(
      createFakeApolloEnvironment({
        OPENROUTER_MODEL: 'openai/gpt-5o',
        ELEVENLABS_TTS_MODEL: 'eleven_flash_v2_5',
      }),
    );
    expect(configuration.models.conversation).toBe('openai/gpt-5o');
    expect(configuration.models.speech).toBe('eleven_flash_v2_5');
    expect(configuration.models.embedding).toBe(defaultModelCatalog.embedding);
  });

  it('treats an empty override as unset', () => {
    const configuration = resolveApolloConfiguration(
      createFakeApolloEnvironment({ OPENROUTER_MODEL: '' }),
    );
    expect(configuration.models.conversation).toBe(defaultModelCatalog.conversation);
  });
});
