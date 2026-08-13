import { describe, expect, it } from 'bun:test';

import {
  createFakeApolloEnvironment,
  createStubDeskToolEffects,
} from '@/configuration/testing';
import { formatDurationForSpeech, setTimerTool, startPomodoroTool } from '@/tools/timer';

function createRecordingEffects() {
  const calls: string[] = [];
  return {
    calls,
    effects: createStubDeskToolEffects({
      scheduleReminder: async ({ delaySeconds, message }) => {
        calls.push(`remind:${delaySeconds}:${message}`);
      },
      applyFocusMinutes: async (minutes) => {
        calls.push(`focus:${minutes}`);
      },
    }),
  };
}

describe('formatDurationForSpeech', () => {
  it('speaks seconds, minutes, and mixed hours naturally', () => {
    expect(formatDurationForSpeech(45)).toBe('45 segundos');
    expect(formatDurationForSpeech(60)).toBe('1 minuto');
    expect(formatDurationForSpeech(600)).toBe('10 minutos');
    expect(formatDurationForSpeech(3600)).toBe('1 hora');
    expect(formatDurationForSpeech(5400)).toBe('1 hora y 30 minutos');
  });
});

describe('setTimerTool', () => {
  it('schedules a reminder that announces the finished timer', async () => {
    const { effects, calls } = createRecordingEffects();

    const result = await setTimerTool.handler(
      { durationSeconds: 600 },
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 1, effects },
    );

    expect(result.ok).toBe(true);
    expect(result.summary).toContain('10 minutos');
    expect(calls).toEqual(['remind:600:Timer de 10 minutos terminado.']);
  });

  it('uses the label in the finish announcement when given', async () => {
    const { effects, calls } = createRecordingEffects();

    await setTimerTool.handler(
      { durationSeconds: 300, label: 'la pasta' },
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 1, effects },
    );

    expect(calls).toEqual(['remind:300:Timer terminado: la pasta.']);
  });
});

describe('startPomodoroTool', () => {
  it('activates focus and schedules the end-of-pomodoro announcement', async () => {
    const { effects, calls } = createRecordingEffects();

    const result = await startPomodoroTool.handler(
      {},
      { environment: createFakeApolloEnvironment(), nowMilliseconds: 1, effects },
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'focus:25',
      'remind:1500:Pomodoro terminado. Tomate un descanso.',
    ]);
  });
});
