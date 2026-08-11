import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';

const DEFAULT_POMODORO_MINUTES = 25;

const setTimerArgsSchema = z.object({
  durationSeconds: z.number().int().min(5).max(86400),
  label: z.string().min(1).max(200).optional(),
});

const startPomodoroArgsSchema = z.object({
  minutes: z.number().int().min(5).max(120).optional(),
});

export function formatDurationForSpeech(durationSeconds: number): string {
  if (durationSeconds < 60) {
    return `${durationSeconds} segundos`;
  }
  const totalMinutes = Math.round(durationSeconds / 60);
  if (totalMinutes < 60) {
    return totalMinutes === 1 ? '1 minuto' : `${totalMinutes} minutos`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  const hoursText = hours === 1 ? '1 hora' : `${hours} horas`;
  return remainingMinutes === 0
    ? hoursText
    : `${hoursText} y ${remainingMinutes} minutos`;
}

// Timers ride the reminder scheduler: a timer is just a short reminder whose
// message announces itself, so cancel_reminder already cancels timers too.
export const setTimerTool: ToolDefinition = {
  name: 'set_timer',
  safety: 'safe',
  description: 'Pone un timer (cuenta regresiva corta) que avisa al terminar',
  parameters: {
    type: 'object',
    properties: {
      durationSeconds: { type: 'number', minimum: 5, maximum: 86400 },
      label: { type: 'string' },
    },
    required: ['durationSeconds'],
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = setTimerArgsSchema.parse(args);
    const durationText = formatDurationForSpeech(parsedArgs.durationSeconds);
    await context.effects.scheduleReminder({
      delaySeconds: parsedArgs.durationSeconds,
      message:
        parsedArgs.label === undefined
          ? `Timer de ${durationText} terminado.`
          : `Timer terminado: ${parsedArgs.label}.`,
    });
    await context.effects.broadcastTimerProgress({
      durationSeconds: parsedArgs.durationSeconds,
    });
    return {
      ok: true,
      summary: `Timer de ${durationText} puesto.`,
    };
  },
};

export const startPomodoroTool: ToolDefinition = {
  name: 'start_pomodoro',
  safety: 'safe',
  description:
    'Arranca un pomodoro: activa focus y avisa cuando termina (25 minutos por defecto)',
  parameters: {
    type: 'object',
    properties: {
      minutes: { type: 'number', minimum: 5, maximum: 120 },
    },
    additionalProperties: false,
  },
  async handler(args, context) {
    if (!context.effects) {
      return { ok: false, summary: 'Effects no disponibles' };
    }
    const parsedArgs = startPomodoroArgsSchema.parse(args);
    const minutes = parsedArgs.minutes ?? DEFAULT_POMODORO_MINUTES;
    await context.effects.applyFocusMinutes(minutes);
    await context.effects.scheduleReminder({
      delaySeconds: minutes * 60,
      message: 'Pomodoro terminado. Tomate un descanso.',
    });
    return {
      ok: true,
      summary: `Pomodoro de ${minutes} minutos arrancado, focus activado.`,
    };
  },
};
