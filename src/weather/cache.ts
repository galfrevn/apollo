import {
  fetchCurrentDeskWeather,
  type DeskWeatherSnapshot,
  type WeatherHttpFetchImplementation,
} from '@/weather/fetch';

export const DESK_WEATHER_CACHE_TTL_MILLISECONDS = 15 * 60 * 1000;

type DeskWeatherCacheEntry = {
  readonly latitude: number;
  readonly longitude: number;
  readonly snapshot: DeskWeatherSnapshot;
  readonly fetchedAtMilliseconds: number;
};

let deskWeatherCacheEntry: DeskWeatherCacheEntry | undefined;

function isSameWeatherLocation(
  leftLatitude: number,
  leftLongitude: number,
  rightLatitude: number,
  rightLongitude: number,
): boolean {
  return leftLatitude === rightLatitude && leftLongitude === rightLongitude;
}

export function clearDeskWeatherCache(): void {
  deskWeatherCacheEntry = undefined;
}

export async function getCachedCurrentDeskWeather(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationLabel: string;
  readonly fetchImpl?: WeatherHttpFetchImplementation;
  readonly nowMilliseconds?: number;
  readonly ttlMilliseconds?: number;
}): Promise<DeskWeatherSnapshot> {
  const nowMilliseconds = input.nowMilliseconds ?? Date.now();
  const ttlMilliseconds = input.ttlMilliseconds ?? DESK_WEATHER_CACHE_TTL_MILLISECONDS;

  if (
    input.fetchImpl === undefined &&
    deskWeatherCacheEntry !== undefined &&
    isSameWeatherLocation(
      deskWeatherCacheEntry.latitude,
      deskWeatherCacheEntry.longitude,
      input.latitude,
      input.longitude,
    ) &&
    nowMilliseconds - deskWeatherCacheEntry.fetchedAtMilliseconds < ttlMilliseconds
  ) {
    return {
      ...deskWeatherCacheEntry.snapshot,
      locationLabel: input.locationLabel,
    };
  }

  const weatherSnapshot = await fetchCurrentDeskWeather({
    latitude: input.latitude,
    longitude: input.longitude,
    locationLabel: input.locationLabel,
    fetchImpl: input.fetchImpl,
  });

  if (input.fetchImpl === undefined) {
    deskWeatherCacheEntry = {
      latitude: input.latitude,
      longitude: input.longitude,
      snapshot: weatherSnapshot,
      fetchedAtMilliseconds: nowMilliseconds,
    };
  }

  return weatherSnapshot;
}
