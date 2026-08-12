# Dollar rates

"¿A cuánto está el blue?" is a daily question in Argentina, so it gets a dedicated client
instead of going through web search: the answer is instant and costs no Tavily quota.

## Tool

- `dollar_rate` — optional `type`; with no type it speaks a summary of the main rates

Supported types (`DOLLAR_RATE_TYPE_LIST` in `apps/agent/src/rates/dollar.ts`): `oficial`, `blue`,
`bolsa`, `contadoconliqui`, `tarjeta`, `cripto`.

## Source

[dolarapi.com](https://dolarapi.com/v1/dolares) — free and keyless, so there is no secret
to rotate. Responses are Zod-parsed (`casa`, `nombre`, `compra`, `venta`,
`fechaActualizacion`); `compra`/`venta` are nullable because some rates quote only one
side.

## Speaking a rate

`formatDollarRateForSpeech` produces "Dólar Blue a $1.480 para la venta y $1.450 para la
compra", falling back to the sale price alone when there is no buy side. The no-argument
summary reads only `blue`, `oficial`, and `tarjeta` (`SUMMARY_CASA_LIST` in
`apps/agent/src/tools/dollar.ts`) rather than all six — six rates in a row is a wall of numbers.

## Navigation

Prev: [Lists](lists.md) · Next: [Email](email.md)
