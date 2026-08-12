import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';
import { getCachedCurrentDeskWeather } from '@/weather/cache';
import { geocodeDeskWeatherLocation } from '@/weather/geocode';

const weatherNowArgsSchema = z.object({
  locationQuery: z.string().min(1).optional(),
});

export const weatherNowTool: ToolDefinition = {
  name: 'weather_now',
  safety: 'safe',
  description:
    'Consulta el clima actual. Sin locationQuery usa la ubicación del escritorio; con locationQuery consulta esa ciudad una sola vez sin guardarla.',
  parameters: {
    type: 'object',
    properties: {
      locationQuery: {
        type: 'string',
        description: 'Ciudad opcional para consulta one-shot (no persiste)',
      },
    },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const parsedArgs = weatherNowArgsSchema.parse(args);

    try {
      const location =
        parsedArgs.locationQuery === undefined
          ? await context.effects.resolveWeatherLocation()
          : await geocodeDeskWeatherLocation({
              locationQuery: parsedArgs.locationQuery,
            });

      const weatherSnapshot = await getCachedCurrentDeskWeather({
        latitude: location.latitude,
        longitude: location.longitude,
        locationLabel: location.locationLabel,
      });

      return {
        ok: true,
        summary: `${weatherSnapshot.locationLabel}: ${weatherSnapshot.temperatureC}°C, ${weatherSnapshot.conditionLabel}`,
        data: weatherSnapshot,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'error desconocido';
      return {
        ok: false,
        summary: `No pude consultar el clima ahora mismo (${errorMessage})`,
      };
    }
  },
};
