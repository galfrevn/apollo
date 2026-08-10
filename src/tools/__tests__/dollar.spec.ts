import { describe, expect, it } from 'bun:test';

import type { DollarRate } from '@/rates/dollar';
import {
  formatDollarRateForSpeech,
  summarizeDollarRateListForSpeech,
} from '@/tools/dollar';

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
