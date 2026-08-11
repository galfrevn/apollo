# Protocol

Device and server speak a Zod-validated JSON protocol defined in `src/protocol/schema.ts`. Binary audio rides alongside; control messages stay structured and small for the ESP32.

## Device → server

| Type | Role |
|------|------|
| `hello` | Identify the device after connect |
| `hold_start` / `hold_end` | Push-to-talk boundaries |
| `wake` | Wake without a full hold gesture |
| `audio_end` | End of a wake-word utterance (VAD-detected) |
| `gesture` | `tap`, `double_tap`, `swipe_left`, `swipe_right` |
| `confirm` | Accept or reject a pending confirmation |
| `text_input` | Typed fallback input |
| `abort` | Stop the speech currently streaming (barge-in) |
| `telemetry` | Battery, charging, volume, WiFi RSSI, firmware version |
| `mcp` | JSON-RPC reply from the device's embedded MCP server |

A listen session ends with the event matching how it started: `hold_end` when a finger
lifts, `audio_end` when a wake-word turn hits its VAD timeout. Both run the turn today;
the split exists so the server can diverge (timeouts, continuity) without a flash.

`telemetry` goes out right after the channel opens, then every 60 seconds, and
immediately on a charging edge. Every payload field is optional — the device omits what
its hardware cannot measure (on the 1.85C the charging bit is a voltage-trend estimate;
there is no charge-status GPIO). The server keeps the latest snapshot in memory, stamps
it into the system prompt while fresh (5 minutes), and announces low battery (≤15%,
30-minute cooldown, re-armed by charging or recovery to 25%) — that announcement pierces
focus mode as `critical`.

Gesture meaning lives on the server, not the device: `tap` toggles the dashboard,
`swipe_left` / `swipe_right` cycle the speech mode, and `double_tap` is deliberately a
no-op (it used to mute the microphone and did so invisibly — see `#handleGesture` in
`src/agents/apollo.ts`).

## Server → device

| Type | Role |
|------|------|
| `ui_state` | Mode, speech mode, caption, focus remaining, face emotion, accent color |
| `confirm_request` | Ask the user to approve a tool side effect |
| `confirm_close` | The confirmation window ended (`resolved` / `expired` / `orphaned`), so the device drops its confirm screen |
| `tts_start` | Announce the next speech clip (one per segment, not one per reply) |
| `tts_aborted` | The clip announced by `tts_start` was cut short and will never complete |
| `error` | Structured failure |
| `dashboard` | Clock + weather snapshot |
| `background_result` | Completed async work summary |
| `reminder` | Reminder delivery |
| `play_effect` | Play a sound effect already burned into device flash |
| `mcp` | JSON-RPC request for the device's embedded MCP server |

`play_effect` carries a logical `name` — `ding` (timer/reminder landing), `chime`
(confirmation request), `error` (turn failure), `low_battery` — and the firmware maps
names to flash assets, so the server can re-purpose sounds without a flash. Unknown
names are logged and ignored. The point is latency: the earcon plays instantly while the
TTS announcement is still being synthesized, and it costs no ElevenLabs credits.

`tts_start` carries `format` (always `pcm` in production), `bytes` for the clip that
follows, and optional `sampleRate` / `channels` — 24 000 Hz mono, so the ESP32 needs no
decoder. The binary frames that follow belong to the clip just announced.

## Device MCP bridge

`mcp` frames carry a raw JSON-RPC object in `payload` and bridge the agent's tools to
the hardware: the server sends `tools/call` requests (`self.audio_speaker.set_volume`,
`self.screen.set_brightness`, `self.get_device_status`), the firmware routes them into
its embedded `McpServer`, and the reply comes back as a device→server `mcp` frame.
Correlation is by JSON-RPC `id`, which **must be an integer** — the device silently
drops string ids. The server awaits each call inside the tool handler with a 5-second
timeout (`src/mcp/bridge.ts`); a timeout or a disconnected device degrades to a spoken
"no está conectado / no respondió" tool result. The firmware's user-only tools
(`self.reboot`, `self.upgrade_firmware`) are callable over the bridge from server code
but are not exposed to the LLM.

## OTA endpoints

Two token-authenticated HTTP routes (same `?token=` shared secret as the websocket URL;
the token appears in device logs on both — an accepted exposure) serve firmware updates
from the `MEDIA` R2 bucket (`src/ota/routes.ts`):

- `GET|POST /ota/check` → `{ "firmware": { "version", "url", "force" } }`, or `{}` when
  no manifest is published. The version is validated server-side against
  `/^\d+(\.\d+)*$/` because the device's version parser aborts on anything else.
- `GET /ota/firmware.bin` → the binary named by `firmware/latest.json`, with an explicit
  `Content-Length` (the device refuses length-less downloads).

The device checks once at boot, right after time sync; a failed check logs and boots
normally. See [Deploy](../operations/deploy.md) for the R2 publishing steps.

## Design notes

- Discriminated unions keep parsing strict on both sides
- Optional fields stay optional — the device should tolerate missing captions, focus seconds, emotion, or accent color
- `ui_state.emotion` and `ui_state.accentColor` tell the device what to render on the face; see [Face](face.md) for the full mapping
- Every device message carries `ts`; `hello` also carries `deviceId`

## Interruption

`abort` and `tts_aborted` are the two halves of barge-in:

1. The device sends `abort` (today: a tap while Apollo is speaking)
2. The server sets a flag; the paced TTS loop checks it between chunks and stops sending
3. The server sends `tts_aborted`

Step 3 matters because `tts_start` promises a byte count and the device counts against it
to know when a clip ends. After an abort that total never arrives, so without
`tts_aborted` the device would wait forever for speech that was cancelled. See
[Voice](voice.md#interruption).

The device-side implementation lives in the firmware repo (`firmware/apollo-firmware`,
a submodule); this chapter is the authoritative wire contract for both sides.

## Navigation

Prev: [Loop](loop.md) · Next: [Voice](voice.md)
