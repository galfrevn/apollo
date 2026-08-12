import { z } from 'zod';

import {
  DOLLAR_RATE_TYPE_LIST,
  type DollarRate,
  fetchDollarRate,
  fetchDollarRateList,
} from '@/rates/dollar';
import type { ToolDefinition } from '@/tools/types';

// Without a type the answer stays speakable: the three rates people actually
// ask about, not all six.
const SUMMARY_CASA_LIST: readonly string[] = ['blue', 'oficial', 'tarjeta'];

const dollarRateArgsSchema = z.object({
  type: z.enum(DOLLAR_RATE_TYPE_LIST).optional(),
});

const pesoFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 0,
});

export function formatDollarRateForSpeech(rate: DollarRate): string {
  if (rate.venta === null) {
    return `${rate.nombre}: sin cotización`;
  }
  const saleText = `$${pesoFormatter.format(rate.venta)}`;
  return rate.compra === null
    ? `${rate.nombre} a ${saleText}`
    : `${rate.nombre} a ${saleText} para la venta y $${pesoFormatter.format(rate.compra)} para la compra`;
}

export function summarizeDollarRateListForSpeech(
  rateList: readonly DollarRate[],
): string {
  return rateList
    .filter((rate) => SUMMARY_CASA_LIST.includes(rate.casa))
    .map((rate) => formatDollarRateForSpeech(rate))
    .join('; ');
}

export const dollarRateTool: ToolDefinition = {
  name: 'dollar_rate',
  safety: 'safe',
  description:
    'Cotización del dólar en Argentina (blue, oficial, bolsa/MEP, contadoconliqui, tarjeta, cripto); sin type devuelve un resumen',
  parameters: {
    type: 'object',
    properties: {
      type: { type: 'string', enum: [...DOLLAR_RATE_TYPE_LIST] },
    },
    additionalProperties: false,
  },
  async handler(args) {
    const parsedArgs = dollarRateArgsSchema.parse(args);

    try {
      if (parsedArgs.type !== undefined) {
        const rate = await fetchDollarRate({ type: parsedArgs.type });
        return {
          ok: true,
          summary: `${formatDollarRateForSpeech(rate)}.`,
          data: rate,
        };
      }

      const rateList = await fetchDollarRateList();
      return {
        ok: true,
        summary: `${summarizeDollarRateListForSpeech(rateList)}.`,
        data: rateList,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'error desconocido';
      return {
        ok: false,
        summary: `No pude traer la cotización (${errorMessage})`,
      };
    }
  },
};
