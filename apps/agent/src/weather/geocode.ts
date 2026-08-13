import { z } from 'zod';

import { DEFAULT_DESK_WEATHER_LOCATION } from '@/configuration/identity';
import type { WeatherHttpFetchImplementation } from '@/weather/fetch';

export type DeskWeatherLocation = {
  readonly locationLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
};

const openMeteoGeocodeResponseSchema = z.object({
  results: z
    .array(
      z.object({
        name: z.string().min(1),
        country: z.string().optional(),
        admin1: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string().optional(),
      }),
    )
    .optional(),
});

function buildOpenMeteoGeocodeUrl(locationQuery: string): string {
  const searchParameters = new URLSearchParams({
    name: locationQuery,
    count: '1',
    language: 'es',
  });
  return `https://geocoding-api.open-meteo.com/v1/search?${searchParameters.toString()}`;
}

function buildLocationLabel(input: {
  readonly name: string;
  readonly admin1?: string;
  readonly country?: string;
}): string {
  return [input.name, input.admin1, input.country].filter(Boolean).join(', ');
}

export async function geocodeDeskWeatherLocation(input: {
  readonly locationQuery: string;
  readonly fetchImpl?: WeatherHttpFetchImplementation;
}): Promise<DeskWeatherLocation> {
  const trimmedQuery = input.locationQuery.trim();
  if (trimmedQuery.length === 0) {
    throw new Error('locationQuery vacío');
  }

  const requestUrl = buildOpenMeteoGeocodeUrl(trimmedQuery);
  const fetchImplementation: WeatherHttpFetchImplementation =
    input.fetchImpl ?? ((url) => fetch(url));
  const response = await fetchImplementation(requestUrl);

  if (!response.ok) {
    throw new Error(`Geocoding failed with status ${response.status}`);
  }

  const parsedPayload = openMeteoGeocodeResponseSchema.parse(await response.json());
  const firstResult = parsedPayload.results?.[0];
  if (firstResult === undefined) {
    throw new Error(`No encontré la ciudad "${trimmedQuery}"`);
  }

  return {
    locationLabel: buildLocationLabel(firstResult),
    latitude: firstResult.latitude,
    longitude: firstResult.longitude,
    timezone: firstResult.timezone ?? DEFAULT_DESK_WEATHER_LOCATION.timezone,
  };
}
