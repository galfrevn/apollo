import { z } from 'zod';

const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const GEOCODE_TIMEOUT_MILLISECONDS = 10_000;

const geocodeResponseSchema = z.object({
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

export type CityCandidate = {
  readonly label: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly timezone: string;
};

export function mapGeocodeResponseToCandidateList(
  rawResponse: unknown,
): readonly CityCandidate[] {
  const parsedResponse = geocodeResponseSchema.parse(rawResponse);
  return (parsedResponse.results ?? [])
    .filter((result) => result.timezone !== undefined)
    .map((result) => ({
      label: [result.name, result.admin1, result.country]
        .filter((part) => part !== undefined && part.length > 0)
        .join(', '),
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone ?? '',
    }));
}

export async function searchCityCandidateList(
  cityQuery: string,
): Promise<readonly CityCandidate[]> {
  const requestUrl = `${OPEN_METEO_GEOCODING_URL}?name=${encodeURIComponent(cityQuery)}&count=5&language=en&format=json`;
  const response = await fetch(requestUrl, {
    signal: AbortSignal.timeout(GEOCODE_TIMEOUT_MILLISECONDS),
  });
  if (!response.ok) {
    throw new Error(`geocoding failed with status ${response.status}`);
  }
  return mapGeocodeResponseToCandidateList(await response.json());
}
