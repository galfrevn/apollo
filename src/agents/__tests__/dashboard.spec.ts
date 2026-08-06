import { describe, expect, it } from 'bun:test';

import {
  buildDeskDashboardPayload,
  DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS,
  resolveDeskDashboardWeatherSnapshot,
  shouldPushDashboardOnWeatherRefresh,
} from '@/agents/dashboard';
import type { DeskWeatherSnapshot } from '@/weather/fetch';

const sampleWeatherSnapshot: DeskWeatherSnapshot = {
  locationLabel: 'Buenos Aires',
  temperatureC: 21,
  conditionLabel: 'Despejado',
  updatedAt: '2026-08-05T17:00',
};

describe('dashboard refresh helpers', () => {
  it('uses a 30 minute refresh interval', () => {
    expect(DESK_DASHBOARD_REFRESH_INTERVAL_SECONDS).toBe(1800);
  });

  it('pushes dashboard only when open and connected', () => {
    expect(
      shouldPushDashboardOnWeatherRefresh({
        uiState: 'dashboard',
        connectionCount: 1,
      }),
    ).toBe(true);
    expect(
      shouldPushDashboardOnWeatherRefresh({
        uiState: 'idle',
        connectionCount: 1,
      }),
    ).toBe(false);
    expect(
      shouldPushDashboardOnWeatherRefresh({
        uiState: 'dashboard',
        connectionCount: 0,
      }),
    ).toBe(false);
  });
});

describe('buildDeskDashboardPayload', () => {
  it('builds a dashboard payload with clock and weather', async () => {
    const fixedNow = new Date('2026-08-05T18:30:00.000Z');
    const payload = await buildDeskDashboardPayload({
      timezone: 'America/Argentina/Buenos_Aires',
      weather: sampleWeatherSnapshot,
      now: fixedNow,
    });

    expect(payload).toEqual({
      type: 'dashboard',
      clock: {
        timezone: 'America/Argentina/Buenos_Aires',
        isoNow: fixedNow.toISOString(),
      },
      weather: sampleWeatherSnapshot,
    });
  });

  it('defaults clock.isoNow to the current time when now is omitted', async () => {
    const beforeMilliseconds = Date.now();
    const payload = await buildDeskDashboardPayload({
      timezone: 'UTC',
      weather: sampleWeatherSnapshot,
    });
    const afterMilliseconds = Date.now();
    const parsedIsoNowMilliseconds = new Date(payload.clock.isoNow).getTime();

    expect(parsedIsoNowMilliseconds).toBeGreaterThanOrEqual(beforeMilliseconds);
    expect(parsedIsoNowMilliseconds).toBeLessThanOrEqual(afterMilliseconds);
  });
});

describe('resolveDeskDashboardWeatherSnapshot', () => {
  it('returns the live snapshot when the fetch succeeds', async () => {
    const snapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: -34.6,
      longitude: -58.4,
      locationLabel: 'Buenos Aires',
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            current: {
              time: '2026-08-05T17:00',
              temperature_2m: 22.1,
              weather_code: 0,
            },
          }),
          { status: 200 },
        ),
    });

    expect(snapshot.conditionLabel).toBe('Despejado');
    expect(snapshot.temperatureC).toBe(22.1);
    expect(snapshot.locationLabel).toBe('Buenos Aires');
  });

  it("falls back to 'Sin datos' with temperatureC 0 when there is no cached snapshot", async () => {
    const snapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: -34.6,
      longitude: -58.4,
      locationLabel: 'Buenos Aires',
      fetchImpl: async () => new Response('nope', { status: 500 }),
    });

    expect(snapshot.conditionLabel).toBe('Sin datos');
    expect(snapshot.temperatureC).toBe(0);
    expect(snapshot.locationLabel).toBe('Buenos Aires');
  });

  it("falls back to 'Sin datos' but keeps the last known temperature when a cache exists", async () => {
    const snapshot = await resolveDeskDashboardWeatherSnapshot({
      latitude: -34.6,
      longitude: -58.4,
      locationLabel: 'Buenos Aires',
      lastKnownSnapshot: sampleWeatherSnapshot,
      fetchImpl: async () => new Response('nope', { status: 500 }),
    });

    expect(snapshot.conditionLabel).toBe('Sin datos');
    expect(snapshot.temperatureC).toBe(sampleWeatherSnapshot.temperatureC);
    expect(snapshot.locationLabel).toBe('Buenos Aires');
  });
});
