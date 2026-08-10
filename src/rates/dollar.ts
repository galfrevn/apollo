import { z } from 'zod';

// dolarapi.com is free and keyless — a dedicated client keeps the daily "¿a
// cuánto está el blue?" instant and off the Tavily search quota.
const DOLLAR_API_BASE_URL = 'https://dolarapi.com/v1/dolares';

export const DOLLAR_RATE_TYPE_LIST = [
  'oficial',
  'blue',
  'bolsa',
  'contadoconliqui',
  'tarjeta',
  'cripto',
] as const;

export type DollarRateType = (typeof DOLLAR_RATE_TYPE_LIST)[number];

export type DollarHttpFetchImplementation = (url: string) => Promise<Response>;

const dollarRateSchema = z.object({
  casa: z.string(),
  nombre: z.string(),
  compra: z.number().nullable(),
  venta: z.number().nullable(),
  fechaActualizacion: z.string(),
});

export type DollarRate = z.infer<typeof dollarRateSchema>;

async function requestDollarApi(
  requestUrl: string,
  fetchImpl: DollarHttpFetchImplementation | undefined,
): Promise<unknown> {
  const fetchImplementation: DollarHttpFetchImplementation =
    fetchImpl ?? ((url) => fetch(url));
  const response = await fetchImplementation(requestUrl);

  if (!response.ok) {
    throw new Error(`dolarapi request failed with status ${response.status}`);
  }

  return response.json();
}

export async function fetchDollarRate(input: {
  readonly type: DollarRateType;
  readonly fetchImpl?: DollarHttpFetchImplementation;
}): Promise<DollarRate> {
  const rawPayload = await requestDollarApi(
    `${DOLLAR_API_BASE_URL}/${input.type}`,
    input.fetchImpl,
  );
  return dollarRateSchema.parse(rawPayload);
}

export async function fetchDollarRateList(
  input: { readonly fetchImpl?: DollarHttpFetchImplementation } = {},
): Promise<readonly DollarRate[]> {
  const rawPayload = await requestDollarApi(DOLLAR_API_BASE_URL, input.fetchImpl);
  return z.array(dollarRateSchema).parse(rawPayload);
}
