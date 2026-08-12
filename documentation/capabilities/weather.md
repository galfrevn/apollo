# Weather

Weather powers spoken answers and the idle dashboard on the ESP32.

## Tools

- `weather_now` — current conditions; optional `locationQuery` for a one-off city (does not persist)
- `set_weather_location` — save the default city used by dashboard refresh

## Dashboard

Dashboard payloads include timezone clock fields plus a weather snapshot (`locationLabel`, `temperatureC`, `conditionLabel`, `updatedAt`). See server → device `dashboard` messages in the protocol chapter.

## Code

Lookup and caching live under `apps/agent/src/weather/`; dashboard assembly is in `apps/agent/src/agents/dashboard.ts`.

## Navigation

Prev: [Research](research.md) · Next: [Focus](focus.md)
