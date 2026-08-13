import { z } from 'zod';

import { DEFAULT_DESK_WEATHER_LOCATION } from '@/weather/defaults';
import type { DeskWeatherLocation } from '@/weather/geocode';

export const WEATHER_LOCATION_PREFERENCE_KEY = 'weatherLocation';

export const deskWeatherLocationSchema = z.object({
  locationLabel: z.string().min(1),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().min(1),
});

export function serializeWeatherLocation(location: DeskWeatherLocation): string {
  return JSON.stringify(deskWeatherLocationSchema.parse(location));
}

export function parseStoredWeatherLocation(rawValue: string | null): DeskWeatherLocation {
  if (rawValue === null) {
    return { ...DEFAULT_DESK_WEATHER_LOCATION };
  }

  try {
    const storedLocationCandidate: unknown = JSON.parse(rawValue);
    return deskWeatherLocationSchema.parse(storedLocationCandidate);
  } catch {
    return { ...DEFAULT_DESK_WEATHER_LOCATION };
  }
}

export async function resolveDeskWeatherLocationFromPreferences(
  readPreference: () => Promise<string | null>,
): Promise<DeskWeatherLocation> {
  return parseStoredWeatherLocation(await readPreference());
}
