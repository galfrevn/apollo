import { describe, expect, it } from 'bun:test';
import {
  mapOpenMeteoWeatherCodeToSpanishLabel,
  fetchCurrentDeskWeather,
} from '@/weather/fetch';

describe('weather fetch', () => {
  it('maps WMO codes to Spanish labels', () => {
    expect(mapOpenMeteoWeatherCodeToSpanishLabel(0)).toBe('Despejado');
    expect(mapOpenMeteoWeatherCodeToSpanishLabel(3)).toBe('Nublado');
    expect(mapOpenMeteoWeatherCodeToSpanishLabel(61)).toBe('Lluvia');
    expect(mapOpenMeteoWeatherCodeToSpanishLabel(999)).toBe('Desconocido');
  });

  it('parses Open-Meteo current weather', async () => {
    const snapshot = await fetchCurrentDeskWeather({
      latitude: -34.6,
      longitude: -58.4,
      locationLabel: 'Buenos Aires',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            current: {
              time: '2026-08-05T17:00',
              temperature_2m: 18.4,
              weather_code: 2,
            },
          }),
          { status: 200 },
        ),
    });
    expect(snapshot.temperatureC).toBe(18.4);
    expect(snapshot.locationLabel).toBe('Buenos Aires');
    expect(snapshot.conditionLabel.length).toBeGreaterThan(0);
    expect(snapshot.updatedAt.length).toBeGreaterThan(0);
  });

  it('throws on non-OK response', async () => {
    await expect(
      fetchCurrentDeskWeather({
        latitude: 0,
        longitude: 0,
        locationLabel: 'X',
        fetchImpl: async () => new Response('nope', { status: 500 }),
      }),
    ).rejects.toThrow();
  });
});
