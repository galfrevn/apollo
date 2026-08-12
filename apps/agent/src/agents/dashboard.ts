import { getCachedCurrentDeskWeather } from '@/weather/cache';
import type {
  DeskWeatherSnapshot,
  WeatherHttpFetchImplementation,
} from '@/weather/fetch';

export const DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS = 1800;

export const UNAVAILABLE_WEATHER_CONDITION_LABEL = 'Sin datos';

export function shouldPushDashboardOnWeatherRefresh(input: {
  readonly uiState: string;
  readonly connectionCount: number;
}): boolean {
  return input.connectionCount > 0 && input.uiState === 'dashboard';
}

export type DeskDashboardPayload = {
  readonly type: 'dashboard';
  readonly clock: { readonly timezone: string; readonly isoNow: string };
  readonly weather: DeskWeatherSnapshot;
};

export async function buildDeskDashboardPayload(input: {
  readonly timezone: string;
  readonly weather: DeskWeatherSnapshot;
  readonly now?: Date;
}): Promise<DeskDashboardPayload> {
  const nowDate = input.now ?? new Date();
  return {
    type: 'dashboard',
    clock: {
      timezone: input.timezone,
      isoNow: nowDate.toISOString(),
    },
    weather: input.weather,
  };
}

export async function resolveDeskDashboardWeatherSnapshot(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationLabel: string;
  readonly lastKnownSnapshot?: DeskWeatherSnapshot;
  readonly nowIso?: string;
  readonly fetchImpl?: WeatherHttpFetchImplementation;
}): Promise<DeskWeatherSnapshot> {
  try {
    return await getCachedCurrentDeskWeather({
      latitude: input.latitude,
      longitude: input.longitude,
      locationLabel: input.locationLabel,
      fetchImpl: input.fetchImpl,
    });
  } catch {
    if (input.lastKnownSnapshot !== undefined) {
      return {
        ...input.lastKnownSnapshot,
        locationLabel: input.locationLabel,
        conditionLabel: UNAVAILABLE_WEATHER_CONDITION_LABEL,
      };
    }
    return {
      locationLabel: input.locationLabel,
      temperatureC: 0,
      conditionLabel: UNAVAILABLE_WEATHER_CONDITION_LABEL,
      updatedAt: input.nowIso ?? new Date().toISOString(),
    };
  }
}
