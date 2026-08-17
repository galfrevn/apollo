import { afterEach, describe, expect, it } from 'bun:test';

import { createFakeApolloEnvironment } from '@/configuration/testing';
import type { DollarRate } from '@/rates/dollar';
import {
  dollarRateTool,
  formatDollarRateForSpeech,
  summarizeDollarRateListForSpeech,
} from '@/tools/dollar';
import type { ToolExecutionContext } from '@/tools/types';

function buildRate(overrides: Partial<DollarRate> = {}): DollarRate {
  return {
    casa: 'blue',
    nombre: 'Blue',
    compra: 1460,
    venta: 1480,
    fechaActualizacion: '2026-08-08T15:00:00.000Z',
    ...overrides,
  };
}

describe('formatDollarRateForSpeech', () => {
  it('speaks both sides with es-AR thousands separators', () => {
    expect(formatDollarRateForSpeech(buildRate())).toBe(
      'Blue a $1.480 para la venta y $1.460 para la compra',
    );
  });

  it('speaks only the sale side when there is no buy price', () => {
    expect(
      formatDollarRateForSpeech(
        buildRate({ nombre: 'Tarjeta', compra: null, venta: 1391 }),
      ),
    ).toBe('Tarjeta a $1.391');
  });

  it('says there is no quote when the sale side is missing', () => {
    expect(formatDollarRateForSpeech(buildRate({ venta: null }))).toBe(
      'Blue: sin cotización',
    );
  });
});

const unavailableFetch = async () =>
  new Response('upstream unavailable', { status: 503 });
const malformedListFetch = async () =>
  new Response(JSON.stringify([{ casa: 'blue', nombre: 'Blue', venta: 1480 }]), {
    headers: { 'Content-Type': 'application/json' },
  });

describe('dollarRateTool fallback responses', () => {
  const originalFetch = globalThis.fetch;
  const context: ToolExecutionContext = {
    environment: createFakeApolloEnvironment(),
    nowMilliseconds: 0,
  };

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns a speakable error when a typed rate request fails upstream', async () => {
    globalThis.fetch = Object.assign(unavailableFetch, { preconnect: () => {} });

    const response = await dollarRateTool.handler({ type: 'blue' }, context);

    expect(response).toEqual({
      ok: false,
      summary: 'No pude traer la cotización (dolarapi request failed with status 503)',
    });
  });

  it('returns a speakable error when the summary payload is malformed', async () => {
    globalThis.fetch = Object.assign(malformedListFetch, { preconnect: () => {} });

    const response = await dollarRateTool.handler({}, context);

    expect(response.ok).toBe(false);
    expect(response.summary).toContain('No pude traer la cotización');
  });
});

describe('summarizeDollarRateListForSpeech', () => {
  it('keeps only blue, oficial, and tarjeta so the answer stays speakable', () => {
    const summary = summarizeDollarRateListForSpeech([
      buildRate(),
      buildRate({ casa: 'oficial', nombre: 'Oficial', compra: 1030, venta: 1070 }),
      buildRate({ casa: 'tarjeta', nombre: 'Tarjeta', compra: null, venta: 1391 }),
      buildRate({ casa: 'cripto', nombre: 'Cripto', compra: 1470, venta: 1490 }),
    ]);

    expect(summary).toContain('Blue');
    expect(summary).toContain('Oficial');
    expect(summary).toContain('Tarjeta');
    expect(summary).not.toContain('Cripto');
  });
});
