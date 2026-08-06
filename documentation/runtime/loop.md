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

When a tool needs confirmation, the server emits `confirm_request` and waits for a device `confirm` message before applying the side effect.

## Dashboard refresh

While idle/dashboard, Apollo can push periodic dashboard payloads (clock + weather) so the desk stays useful without a conversation.

## Navigation

Prev: [Concepts](../introduction/concepts.md) · Next: [Protocol](protocol.md)
