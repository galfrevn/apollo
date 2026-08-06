import { describe, expect, it } from 'bun:test';

import { geocodeDeskWeatherLocation } from '@/weather/geocode';

describe('geocodeDeskWeatherLocation', () => {
  it('maps the first Open-Meteo result', async () => {
    const location = await geocodeDeskWeatherLocation({
      locationQuery: 'Córdoba',
      fetchImpl: async (requestUrl) => {
        expect(requestUrl).toContain('geocoding-api.open-meteo.com');
        expect(requestUrl).toContain('name=');
        return new Response(
          JSON.stringify({
            results: [
              {
                name: 'Córdoba',
                country: 'Argentina',
                latitude: -31.4135,
                longitude: -64.18105,
                timezone: 'America/Argentina/Cordoba',
              },
            ],
          }),
          { status: 200 },
        );
      },
    });
    expect(location.locationLabel).toContain('Córdoba');
    expect(location.latitude).toBe(-31.4135);
    expect(location.longitude).toBe(-64.18105);
    expect(location.timezone).toBe('America/Argentina/Cordoba');
  });

  it('throws when results are empty', async () => {
    await expect(
      geocodeDeskWeatherLocation({
        locationQuery: 'zzzzz',
        fetchImpl: async () =>
          new Response(JSON.stringify({ results: [] }), { status: 200 }),
      }),
    ).rejects.toThrow();
  });

  it('throws on non-OK response', async () => {
    await expect(
      geocodeDeskWeatherLocation({
        locationQuery: 'X',
        fetchImpl: async () => new Response('nope', { status: 500 }),
      }),
    ).rejects.toThrow();
  });
});
