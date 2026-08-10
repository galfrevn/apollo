import { describe, expect, it } from 'bun:test';

import { buildApolloSoulPrompt } from '@/persona/soul';

describe('apollo soul prompt', () => {
  it('always includes Apollo identity and shared tools base', () => {
    const soulPrompt = buildApolloSoulPrompt('default');
    expect(soulPrompt).toContain('Sos Apollo');
    expect(soulPrompt).toContain('remember_fact');
    expect(soulPrompt).toContain('weather_now');
    expect(soulPrompt).toContain('set_weather_location');
    expect(soulPrompt).toContain('list_reminders');
    expect(soulPrompt).toContain('cancel_reminder');
    expect(soulPrompt).not.toContain('gmail');
  });

  it('includes nerd technical register', () => {
    expect(buildApolloSoulPrompt('nerd')).toContain('Modo nerd');
    expect(buildApolloSoulPrompt('nerd')).toContain('técnico');
  });

  it('includes playful slang guidance', () => {
    const soulPrompt = buildApolloSoulPrompt('playful');
    expect(soulPrompt).toContain('Modo playful');
    expect(soulPrompt).toContain('boludo');
    expect(soulPrompt).toContain('nunca humilles');
  });

  it('includes warm closeness guidance', () => {
    expect(buildApolloSoulPrompt('warm')).toContain('Modo warm');
  });
});
