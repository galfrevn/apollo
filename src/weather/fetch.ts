import { z } from 'zod';

export type DeskWeatherSnapshot = {
  readonly locationLabel: string;
  readonly temperatureC: number;
  readonly conditionLabel: string;
  readonly updatedAt: string;
};

export type WeatherHttpFetchImplementation = (requestUrl: string) => Promise<Response>;

const openMeteoCurrentWeatherSchema = z.object({
  current: z.object({
    time: z.string().min(1),
    temperature_2m: z.number(),
    weather_code: z.number().int(),
  }),
});

const wmoWeatherCodeToSpanishLabelMap: Readonly<Record<number, string>> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna',
  61: 'Lluvia',
  71: 'Nieve',
  80: 'Chubascos',
  95: 'Tormenta',
};

export function mapOpenMeteoWeatherCodeToSpanishLabel(weatherCode: number): string {
  return wmoWeatherCodeToSpanishLabelMap[weatherCode] ?? 'Desconocido';
}

function buildOpenMeteoForecastUrl(latitude: number, longitude: number): string {
  const searchParameters = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,weather_code',
  });
  return `https://api.open-meteo.com/v1/forecast?${searchParameters.toString()}`;
}

export async function fetchCurrentDeskWeather(input: {
  readonly latitude: number;
  readonly longitude: number;
  readonly locationLabel: string;
  readonly fetchImpl?: WeatherHttpFetchImplementation;
}): Promise<DeskWeatherSnapshot> {
  const requestUrl = buildOpenMeteoForecastUrl(input.latitude, input.longitude);
  const fetchImplementation: WeatherHttpFetchImplementation =
    input.fetchImpl ?? ((url) => fetch(url));
  const response = await fetchImplementation(requestUrl);

  if (!response.ok) {
    throw new Error(`Open-Meteo request failed with status ${response.status}`);
  }

  const rawPayload: unknown = await response.json();
  const parsedPayload = openMeteoCurrentWeatherSchema.parse(rawPayload);

  return {
    locationLabel: input.locationLabel,
    temperatureC: parsedPayload.current.temperature_2m,
    conditionLabel: mapOpenMeteoWeatherCodeToSpanishLabel(
      parsedPayload.current.weather_code,
    ),
    updatedAt: parsedPayload.current.time,
  };
}
