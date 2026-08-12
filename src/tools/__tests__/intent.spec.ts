import { describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import { setFocusTool, clearFocusTool } from '@/tools/focus';
import { setWeatherLocationTool } from '@/tools/location';
import { rememberFactTool } from '@/tools/memory';
import { cancelReminderTool, listRemindersTool, setReminderTool } from '@/tools/reminder';
import { startResearchTool } from '@/tools/research';
import type { DeskToolEffects } from '@/tools/types';
import { weatherNowTool } from '@/tools/weather';
import { clearDeskWeatherCache } from '@/weather/cache';

function createTypedFetchMock(responseBody: unknown): typeof fetch {
  const fetchHandler = async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => new Response(JSON.stringify(responseBody), { status: 200 });

  return Object.assign(fetchHandler, {
    preconnect: () => {},
  }) as typeof fetch;
}

function createTypedFetchMockWithStatus(
  responseBody: string,
  status: number,
): typeof fetch {
  const fetchHandler = async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => new Response(responseBody, { status });

  return Object.assign(fetchHandler, {
    preconnect: () => {},
  }) as typeof fetch;
}

function createRejectingFetchMock(error: Error): typeof fetch {
  const fetchHandler = async (
    _input: RequestInfo | URL,
    _init?: RequestInit,
  ): Promise<Response> => {
    throw error;
  };

  return Object.assign(fetchHandler, {
    preconnect: () => {},
  }) as typeof fetch;
}

function createRecordingEffects(): DeskToolEffects & {
  readonly calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    persistMemory: async (content) => {
      calls.push(`memory:${content}`);
      return { memoryId: 'm1', content };
    },
    applyFocusMinutes: async (minutes) => {
      calls.push(`focus:${minutes}`);
    },
    clearFocus: async () => {
      calls.push('clearFocus');
    },
    enqueueResearch: async (prompt) => {
      calls.push(`research:${prompt}`);
    },
    enqueueCodingTask: async ({ repository, task }) => {
      calls.push(`coding:${repository}:${task}`);
    },
    callDeviceTool: async ({ deviceToolName }) => {
      calls.push(`device:${deviceToolName}`);
      return { ok: true, summary: 'true' };
    },
    callInstalledMcpTool: async ({ serverId, toolName }) => {
      calls.push(`mcp:${serverId}:${toolName}`);
      return { ok: true, summary: 'true' };
    },
    scheduleReminder: async ({ delaySeconds, message }) => {
      calls.push(`remind:${delaySeconds}:${message}`);
    },
    broadcastTimerProgress: async ({ durationSeconds }) => {
      calls.push(`timerArc:${durationSeconds}`);
    },
    listReminders: async () => {
      calls.push('listReminders');
      return [
        {
          id: 'r1',
          message: 'tomá agua',
          firesAtIso: '2026-08-05T18:10:00.000Z',
          delayInSeconds: 600,
        },
      ];
    },
    cancelReminders: async (input) => {
      calls.push(`cancel:${input.cancelAll ? 'all' : (input.message ?? '')}`);
      return {
        cancelledCount: input.cancelAll ? 2 : 1,
        cancelledMessageList: input.cancelAll ? ['a', 'b'] : ['tomá agua'],
      };
    },
    resolveWeatherLocation: async () => ({
      latitude: -34.6,
      longitude: -58.4,
      locationLabel: 'Buenos Aires',
      timezone: 'America/Argentina/Buenos_Aires',
    }),
    persistWeatherLocation: async (location) => {
      calls.push(`persistWeather:${location.locationLabel}`);
    },
    addListItem: async ({ listName, content }) => {
      calls.push(`listAdd:${listName}:${content}`);
      return { id: 'l1', listName, content, createdAt: 1 };
    },
    listListItems: async (listName) => {
      calls.push(`listRead:${listName ?? '*'}`);
      return [
        { id: 'l1', listName: listName ?? 'super', content: 'yerba', createdAt: 1 },
      ];
    },
    removeListItems: async ({ listName, contentQuery, clearAll }) => {
      calls.push(`listRemove:${listName}:${clearAll ? 'all' : (contentQuery ?? '')}`);
      return { removedCount: 1, removedContentList: ['yerba'] };
    },
  };
}

describe('intent tools', () => {
  it('remember_fact persists via effects', async () => {
    const effects = createRecordingEffects();
    const result = await rememberFactTool.handler(
      { content: 'tomo mate' },
      {
        environment: createFakeApolloEnvironment(),
        nowMilliseconds: 1,
        effects,
      },
    );
    expect(result.ok).toBe(true);
    expect(effects.calls).toContain('memory:tomo mate');
  });

  it('set_focus and clear_focus call effects', async () => {
    const effects = createRecordingEffects();
    const context = {
      environment: createFakeApolloEnvironment(),
      nowMilliseconds: 1,
      effects,
    };
    await setFocusTool.handler({ minutes: 25 }, context);
    await clearFocusTool.handler({}, context);
    expect(effects.calls).toEqual(['focus:25', 'clearFocus']);
  });

  it('start_research and set_reminder call effects', async () => {
    const effects = createRecordingEffects();
    const context = {
      environment: createFakeApolloEnvironment(),
      nowMilliseconds: 1,
      effects,
    };
    await startResearchTool.handler({ prompt: 'resumí X' }, context);
    await setReminderTool.handler({ message: 'agua', delaySeconds: 60 }, context);
    expect(effects.calls).toContain('research:resumí X');
    expect(effects.calls).toContain('remind:60:agua');
  });

  it('list_reminders and cancel_reminder use effects', async () => {
    const effects = createRecordingEffects();
    const context = {
      environment: createFakeApolloEnvironment(),
      nowMilliseconds: Date.parse('2026-08-05T18:00:00.000Z'),
      effects,
    };
    const listResult = await listRemindersTool.handler({}, context);
    expect(listResult.ok).toBe(true);
    expect(listResult.summary).toContain('tomá agua');
    expect(effects.calls).toContain('listReminders');

    const cancelResult = await cancelReminderTool.handler({ message: 'agua' }, context);
    expect(cancelResult.ok).toBe(true);
    expect(cancelResult.summary).toContain('Cancelé');
    expect(effects.calls).toContain('cancel:agua');
  });

  it('cancel_reminder requires message or cancelAll', async () => {
    const result = await cancelReminderTool.handler(
      {},
      {
        environment: createFakeApolloEnvironment(),
        nowMilliseconds: 1,
        effects: createRecordingEffects(),
      },
    );
    expect(result.ok).toBe(false);
  });

  it('set_weather_location geocodes and persists', async () => {
    const effects = createRecordingEffects();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createTypedFetchMock({
      results: [
        {
          name: 'Córdoba',
          country: 'Argentina',
          latitude: -31.4,
          longitude: -64.2,
          timezone: 'America/Argentina/Cordoba',
        },
      ],
    });
    try {
      const result = await setWeatherLocationTool.handler(
        { locationQuery: 'Córdoba' },
        {
          environment: createFakeApolloEnvironment(),
          nowMilliseconds: 1,
          effects,
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('Córdoba');
      expect(effects.calls.some((call) => call.startsWith('persistWeather:'))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('weather_now with locationQuery does not persist', async () => {
    clearDeskWeatherCache();
    const effects = createRecordingEffects();
    const originalFetch = globalThis.fetch;
    let callCount = 0;
    globalThis.fetch = Object.assign(
      async (input: RequestInfo | URL) => {
        callCount += 1;
        const requestUrl = String(input);
        if (requestUrl.includes('geocoding-api')) {
          return new Response(
            JSON.stringify({
              results: [
                {
                  name: 'Rosario',
                  country: 'Argentina',
                  latitude: -32.95,
                  longitude: -60.65,
                  timezone: 'America/Argentina/Buenos_Aires',
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            current: {
              time: '2026-08-05T17:00',
              temperature_2m: 20,
              weather_code: 0,
            },
          }),
          { status: 200 },
        );
      },
      { preconnect: () => {} },
    ) as typeof fetch;
    try {
      const result = await weatherNowTool.handler(
        { locationQuery: 'Rosario' },
        {
          environment: createFakeApolloEnvironment(),
          nowMilliseconds: 1,
          effects,
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('Rosario');
      expect(effects.calls.some((call) => call.startsWith('persistWeather:'))).toBe(
        false,
      );
      expect(callCount).toBeGreaterThanOrEqual(2);
    } finally {
      globalThis.fetch = originalFetch;
      clearDeskWeatherCache();
    }
  });

  it('weather_now uses fetcher via location effects', async () => {
    clearDeskWeatherCache();
    const effects = createRecordingEffects();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createTypedFetchMock({
      current: {
        time: '2026-08-05T17:00',
        temperature_2m: 20,
        weather_code: 0,
      },
    });
    try {
      const result = await weatherNowTool.handler(
        {},
        {
          environment: createFakeApolloEnvironment(),
          nowMilliseconds: 1,
          effects,
        },
      );
      expect(result.ok).toBe(true);
      expect(result.summary).toContain('20');
    } finally {
      globalThis.fetch = originalFetch;
      clearDeskWeatherCache();
    }
  });

  it('weather_now returns ok:false when the fetch rejects', async () => {
    clearDeskWeatherCache();
    const effects = createRecordingEffects();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createRejectingFetchMock(new Error('network unreachable'));
    try {
      const result = await weatherNowTool.handler(
        {},
        {
          environment: createFakeApolloEnvironment(),
          nowMilliseconds: 1,
          effects,
        },
      );
      expect(result.ok).toBe(false);
      expect(result.summary).toContain('network unreachable');
    } finally {
      globalThis.fetch = originalFetch;
      clearDeskWeatherCache();
    }
  });

  it('weather_now returns ok:false when the API responds with an error status', async () => {
    clearDeskWeatherCache();
    const effects = createRecordingEffects();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = createTypedFetchMockWithStatus('upstream down', 503);
    try {
      const result = await weatherNowTool.handler(
        {},
        {
          environment: createFakeApolloEnvironment(),
          nowMilliseconds: 1,
          effects,
        },
      );
      expect(result.ok).toBe(false);
      expect(result.summary.length).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
      clearDeskWeatherCache();
    }
  });

  it('weather_now returns ok:false when resolving the location fails', async () => {
    const effects: DeskToolEffects = {
      ...createRecordingEffects(),
      resolveWeatherLocation: async () => {
        throw new Error('location service unavailable');
      },
    };
    const result = await weatherNowTool.handler(
      {},
      {
        environment: createFakeApolloEnvironment(),
        nowMilliseconds: 1,
        effects,
      },
    );
    expect(result.ok).toBe(false);
    expect(result.summary).toContain('location service unavailable');
  });
});
