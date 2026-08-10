# Loop

A desk interaction is a loop: connect, authorize, exchange control messages and audio, run a turn, push UI and TTS back to the device.

## Entry points

- `GET /health` returns a small JSON capability advertisement
- Agent WebSocket/HTTP routes are handled via the Cloudflare Agents request router
- Queue consumers process background jobs outside the interactive turn

Primary wiring lives in `src/index.ts` and `src/agents/apollo.ts`.

## Happy path

1. ESP32 connects with a device token and sends `hello`
2. User wakes or holds to talk; audio frames stream to the agent
3. On `audio_end` (or `text_input`), Apollo runs a turn
4. The server updates `ui_state` through listening → thinking → speaking
5. TTS audio is announced (`tts_start`) and streamed; captions may accompany speech
6. Control returns to `idle`, `focus`, or `dashboard`

## Confirmations

When a tool needs confirmation, the server emits `confirm_request` and waits for a device `confirm` message before applying the side effect. A confirmation expires after 30 seconds.

No tool in the shipped catalog currently requires this — see [Tools](../capabilities/tools.md#confirmations).

## Interruption

A device `abort` cuts the reply short: the pacing loop checks the flag between chunks and stops, then the server sends `tts_aborted`. See [Voice](voice.md#interruption).

## Dashboard refresh

Apollo pushes a dashboard payload (clock + weather) on connect, on the tap that opens the dashboard, and then every 30 minutes — but the periodic refresh only fires while the UI is actually in `dashboard` state and someone is connected (`shouldPushDashboardOnWeatherRefresh` in `src/agents/dashboard.ts`). Idle receives no periodic push.

## Guardrails

- A turn needs at least 8000 bytes of audio (a quarter second at 16 kHz); below that the server answers "no llegué a escucharte" instead of sending an empty clip to the transcriber
- A turn runs at most 3 tool rounds (`src/turn/run.ts`) before it has to answer with what it has

## Navigation

Prev: [Concepts](../introduction/concepts.md) · Next: [Protocol](protocol.md)
