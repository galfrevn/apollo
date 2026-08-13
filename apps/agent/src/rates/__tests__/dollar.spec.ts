import { describe, expect, it } from 'bun:test';

import {
  type DollarHttpFetchImplementation,
  type DollarRate,
  fetchDollarRate,
  fetchDollarRateList,
} from '@/rates/dollar';

const blueRate = {
  casa: 'blue',
  nombre: 'Blue',
  compra: 1460,
  venta: 1480,
  fechaActualizacion: '2026-08-08T15:00:00.000Z',
};

function createCapturingFetchMock(
  payload: DollarRate | readonly DollarRate[],
  status = 200,
) {
  const requestedUrlList: string[] = [];
  const fetchImpl: DollarHttpFetchImplementation = async (url) => {
    requestedUrlList.push(url);
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetchImpl, requestedUrlList };
}

describe('fetchDollarRate', () => {
  it('requests the per-type endpoint and parses the rate', async () => {
    const { fetchImpl, requestedUrlList } = createCapturingFetchMock(blueRate);

    const rate = await fetchDollarRate({ type: 'blue', fetchImpl });

    expect(requestedUrlList).toEqual(['https://dolarapi.com/v1/dolares/blue']);
    expect(rate.nombre).toBe('Blue');
    expect(rate.venta).toBe(1480);
  });

  it('throws on a non-ok response', async () => {
    const { fetchImpl } = createCapturingFetchMock(blueRate, 500);

    await expect(fetchDollarRate({ type: 'blue', fetchImpl })).rejects.toThrow(
      'dolarapi request failed with status 500',
    );
  });
});

describe('fetchDollarRateList', () => {
  it('requests the collection endpoint and parses every rate', async () => {
    const { fetchImpl, requestedUrlList } = createCapturingFetchMock([
      blueRate,
      { ...blueRate, casa: 'tarjeta', nombre: 'Tarjeta', compra: null, venta: 1391 },
    ]);

    const rateList = await fetchDollarRateList({ fetchImpl });

    expect(requestedUrlList).toEqual(['https://dolarapi.com/v1/dolares']);
    expect(rateList.map((rate) => rate.casa)).toEqual(['blue', 'tarjeta']);
    expect(rateList[1].compra).toBeNull();
  });
});
