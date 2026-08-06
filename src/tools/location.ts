import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';
import { geocodeDeskWeatherLocation } from '@/weather/geocode';

const setWeatherLocationArgsSchema = z.object({
  locationQuery: z.string().min(1),
});

export const setWeatherLocationTool: ToolDefinition = {
  name: 'set_weather_location',
  safety: 'safe',
  description:
    'Guarda la ubicación default del clima del escritorio (ciudad). Usar cuando el usuario dice que su ubicación es X o que ponga el clima en X.',
  parameters: {
    type: 'object',
    properties: {
      locationQuery: { type: 'string', description: 'Ciudad o lugar a guardar' },
    },
    required: ['locationQuery'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }

    const { locationQuery } = setWeatherLocationArgsSchema.parse(args);

    try {
      const location = await geocodeDeskWeatherLocation({ locationQuery });
      await context.effects.persistWeatherLocation(location);
      return {
        ok: true,
        summary: `Ubicación del clima: ${location.locationLabel}`,
        data: location,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'error desconocido';
      return {
        ok: false,
        summary: `No pude guardar la ubicación (${errorMessage})`,
      };
    }
  },
};
