import { describe, expect, it } from 'bun:test';

import { DEFAULT_DESK_WEATHER_LOCATION } from '@/configuration/identity';
import {
  parseStoredWeatherLocation,
  resolveDeskWeatherLocationFromPreferences,
  serializeWeatherLocation,
  WEATHER_LOCATION_PREFERENCE_KEY,
} from '@/weather/location';

describe('weather location preference', () => {
  it('exposes preference key', () => {
    expect(WEATHER_LOCATION_PREFERENCE_KEY).toBe('weatherLocation');
  });

  it('round-trips a valid location', () => {
    const location = {
      locationLabel: 'Córdoba, Argentina',
      latitude: -31.4,
      longitude: -64.2,
      timezone: 'America/Argentina/Cordoba',
    };
    const parsed = parseStoredWeatherLocation(serializeWeatherLocation(location));
    expect(parsed).toEqual(location);
  });

  it('falls back to Buenos Aires on null or corrupt JSON', () => {
    expect(parseStoredWeatherLocation(null)).toEqual(DEFAULT_DESK_WEATHER_LOCATION);
    expect(parseStoredWeatherLocation('{nope')).toEqual(DEFAULT_DESK_WEATHER_LOCATION);
  });

  it('resolveDeskWeatherLocationFromPreferences reads stored JSON', async () => {
    const location = await resolveDeskWeatherLocationFromPreferences(async () =>
      serializeWeatherLocation({
        locationLabel: 'Mendoza, Argentina',
        latitude: -32.89,
        longitude: -68.83,
        timezone: 'America/Argentina/Mendoza',
      }),
    );
    expect(location.locationLabel).toContain('Mendoza');
  });
});
