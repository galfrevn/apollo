import { describe, expect, it } from 'bun:test';

import { mapGeocodeResponseToCandidateList } from '@/geocode';
import { mapVoicesResponseToChoiceList, MAXIMUM_VOICE_CHOICE_COUNT } from '@/keys';

describe('mapGeocodeResponseToCandidateList', () => {
  it('labels candidates and drops entries without a timezone', () => {
    const candidateList = mapGeocodeResponseToCandidateList({
      results: [
        {
          name: 'Madrid',
          admin1: 'Madrid',
          country: 'Spain',
          latitude: 40.4168,
          longitude: -3.7038,
          timezone: 'Europe/Madrid',
        },
        { name: 'Madrid', latitude: 4.73, longitude: -74.26 },
      ],
    });
    expect(candidateList).toHaveLength(1);
    expect(candidateList[0].label).toBe('Madrid, Madrid, Spain');
    expect(candidateList[0].timezone).toBe('Europe/Madrid');
  });

  it('returns empty for a resultless response', () => {
    expect(mapGeocodeResponseToCandidateList({})).toHaveLength(0);
  });
});

describe('mapVoicesResponseToChoiceList', () => {
  it('builds display labels from name, accent, and category', () => {
    const choiceList = mapVoicesResponseToChoiceList({
      voices: [
        {
          voice_id: 'voice-1',
          name: 'Malena',
          category: 'cloned',
          labels: { accent: 'argentine', language: 'es' },
        },
        { voice_id: 'voice-2', name: 'Plain' },
      ],
    });
    expect(choiceList[0]).toEqual({
      voiceId: 'voice-1',
      displayLabel: 'Malena (argentine, es, cloned)',
    });
    expect(choiceList[1]).toEqual({ voiceId: 'voice-2', displayLabel: 'Plain' });
  });

  it('caps the list', () => {
    const oversizedVoiceList = Array.from({ length: 50 }, (_, index) => ({
      voice_id: `voice-${index}`,
      name: `Voice ${index}`,
    }));
    expect(mapVoicesResponseToChoiceList({ voices: oversizedVoiceList })).toHaveLength(
      MAXIMUM_VOICE_CHOICE_COUNT,
    );
  });
});
