---
name: apollo-protocol
description: The canonical Apollo device wire contract — WebSocket messages, PCM audio framing, auth, MCP device bridge, and OTA over HTTP. Load when writing or debugging firmware or any custom client that talks to the Apollo worker, when adding or changing protocol messages, or when diagnosing audio, barge-in, confirm, telemetry, or OTA behavior on the wire.
---

# Apollo device protocol

Device and server speak a Zod-validated JSON protocol; binary PCM audio rides alongside on the same WebSocket. The executable truth is `src/protocol/schema.ts` (discriminated unions, tests in `src/protocol/__tests__/schema.spec.ts`); the prose contract is `documentation/runtime/protocol.md`. This skill is the wire reference for building a client without reading the reference firmware.

Two hard rules for every client:

- **Tolerate unknown frames.** The server may add message types and optional fields at any time; ignore what you do not recognize. The server does the same for unknown `play_effect` names (logged, ignored). Optional fields stay optional — never require `caption`, `focusRemainingSec`, `emotion`, or `accentColor`.
- **JSON text frames are control, binary frames are audio.** Both directions. A text frame that fails to parse against the schema earns a server reply `{ "type": "error", "code": "invalid_message", "message": "Mensaje no reconocido" }`.

## Connection

```
wss://<worker-host>/agents/apollo/<instance-name>?token=<DEVICE_SHARED_SECRET>
```

- The instance name in the path **is** the device identity — each name is its own Durable Object with its own memory. `desk` is the convention; the hosted console at `https://heyapollo.dev/console` connects to any worker URL + instance name + dashboard secret.
- Auth is the `?token=` query parameter, checked with a timing-safe byte compare (`src/auth/token.ts`) **before** the WebSocket upgrade; a bad or missing token gets a plain `401 Unauthorized`. An unset `DEVICE_SHARED_SECRET` secret rejects every connection rather than throwing.
- The token decides the role (`src/auth/role.ts`): `DEVICE_SHARED_SECRET` → `device`, `DASHBOARD_SHARED_SECRET` → `dashboard`. Only device-role connections receive protocol frames or have their protocol frames honored; dashboard connections get state sync and RPC only.
- `GET /health` (no auth, CORS `*`) returns `{ ok, name: "apollo", features: [...] }` — `features` includes `"coding"` only when the optional Sandbox binding exists.

On a device connect, the server sends unprompted, in order:

1. `ui_state` — current mode, speech mode, emotion, accent color (any stale caption is cleared first).
2. `dashboard` — clock + weather snapshot.
3. A flush of pending messages queued while the device was offline: reminders and `background_result`s arrive as **silent cards**; queued console broadcasts **replay with sound** (chime + full TTS run). The flush consumes what it sends.

The server also captures the connection's origin (stored as the `publicOrigin` session preference) — OTA push URLs are built from it, so the URL handed to the device is one it provably reached.

## Device → server messages

Every message carries `ts` (non-negative integer, epoch milliseconds). Shapes from `src/protocol/schema.ts`:

| Type | Extra fields | Meaning |
|------|-------------|---------|
| `hello` | `deviceId: string` | Identify after connect; server re-pushes `ui_state` |
| `hold_start` | — | Push-to-talk press; server clears the audio buffer and enters `listening` |
| `hold_end` | — | Press released; buffered audio runs as a turn |
| `wake` | — | Wake-word start; same buffer reset as `hold_start` |
| `audio_end` | — | VAD-detected end of a wake-word utterance; runs the turn |
| `listen_cancel` | — | User cancelled an open listen; buffer discarded, no turn |
| `gesture` | `gesture: 'tap' \| 'double_tap' \| 'swipe_left' \| 'swipe_right'` | Raw gesture; meaning is server-owned |
| `confirm` | `ok: boolean` | Answer to a pending `confirm_request` |
| `text_input` | `text: string` | Typed fallback; runs a turn without STT |
| `abort` | — | Barge-in: stop the speech currently streaming |
| `telemetry` | `battery?: 0–100 int`, `charging?: boolean`, `volume?: int`, `wifiRssi?: int`, `firmwareVersion?: string` | Every field optional — omit what the hardware cannot measure |
| `mcp` | `payload: { jsonrpc: '2.0', id: int, result?, error?: { code?, message } }` | JSON-RPC reply from the device's embedded MCP server |
| `playback_ack` | `sequence: int`, `playedMilliseconds: int` | Closed-loop playback progress for the clip tagged with that sequence |

Notes:

- A listen session ends with the event matching how it started: `hold_end` for a hold, `audio_end` for a wake-word turn. Both run the turn today; the split exists so the server can diverge without a device flash.
- `telemetry` cadence: right after connect, then every 60 seconds, and immediately on a charging edge. Telemetry steers low-battery announcements and the OTA push lifecycle (below).
- Gesture **meaning lives on the server**: `tap` toggles the dashboard (`idle` ↔ `dashboard`), `swipe_left`/`swipe_right` cycle the speech mode (announced by the accent ring color, deliberately no caption), `double_tap` is a deliberate no-op (it used to mute the mic invisibly). Devices send raw gestures and render whatever `ui_state` comes back.

## Server → device messages

| Type | Fields | Meaning |
|------|--------|---------|
| `ui_state` | `state`, `speechMode: string`, `caption?`, `focusRemainingSec?`, `focusStartedAt?`, `focusEndsAt?`, `emotion?`, `accentColor?` | Full render instruction; event-driven pushes |
| `confirm_request` | `id`, `summary`, `expiresAt` (epoch ms) | Ask approval for a tool side effect; window is 30 000 ms (`CONFIRM_TIMEOUT_MILLISECONDS`, `src/tools/types.ts`) |
| `confirm_close` | `id`, `reason: 'resolved' \| 'expired' \| 'orphaned'` | Drop the confirm screen |
| `tts_start` | `format: 'mp3' \| 'wav' \| 'pcm'`, `bytes?`, `sequence?`, `sampleRate?`, `channels?` | Announces the next speech clip; the binary frames that follow belong to it |
| `tts_end` | — | Closes the current clip's run |
| `tts_aborted` | — | The announced clip was cut short and will never complete |
| `timer` | `endsAt?` (epoch s), `durationSeconds?` | Countdown arc; **both absent means clear the arc** |
| `turn_end` | `expectsReply: boolean` | The turn's speech is fully sent; mic policy below |
| `error` | `code`, `message` | Structured failure (`invalid_message`, `turn_failed`, …) |
| `dashboard` | `clock: { timezone, isoNow }`, `weather: { locationLabel, temperatureC, conditionLabel, updatedAt }` | Clock + weather snapshot |
| `background_result` | `summary`, `prompt`, `documentKey?` | Completed async work card |
| `reminder` | `message` | Reminder card |
| `play_effect` | `name: 'ding' \| 'chime' \| 'error' \| 'low_battery'` | Logical earcon; device maps names to flash assets, unknown names ignored |
| `mcp` | `payload: { jsonrpc: '2.0', id: int, method, params? }` | JSON-RPC request for the device's embedded MCP server |

`ui_state.state` is one of `idle`, `listening`, `thinking`, `confirm`, `speaking`, `focus`, `dashboard`. `focusStartedAt`/`focusEndsAt` are epoch **seconds** — pushes are event-driven, so the device gets the whole window to count down locally between pushes.

`play_effect` exists for latency: the earcon plays instantly from device flash while the TTS announcement is still synthesizing, at zero TTS credits. Convention: `ding` for timer/reminder landings, `chime` for confirmation requests and console broadcasts, `error` for turn failures, `low_battery` for the battery warning.

## Audio uplink (mic → server)

- **Raw s16le PCM, 16 000 Hz, mono, 16-bit** (`DEVICE_MIC_PCM_SAMPLE_RATE_HZ` in `src/voice/wav.ts`). No header, no container — binary WebSocket frames of any size.
- The server buffers every binary frame it receives; `hold_start`/`wake` reset the buffer, `hold_end`/`audio_end` concatenate and run the turn, `listen_cancel` discards.
- **Floor: 8 000 bytes** (`MINIMUM_TURN_AUDIO_BYTE_LENGTH`, `src/agents/apollo.ts`) — 250 ms at 16 kHz mono s16le. Below it, no turn runs; the server cancels back to idle with the caption "No llegué a escucharte, mantené apretado un momento más." The server wraps the PCM in a WAV header itself before STT — the device never sends one.

## Audio downlink (TTS → speaker)

- **Raw s16le PCM, 24 000 Hz, mono** (`TTS_PCM_SAMPLE_RATE_HZ`, `src/voice/elevenlabs.ts`), chosen so the ESP32 needs no decoder. `tts_start.format` is always `pcm` in production; `sampleRate`/`channels` are sent explicitly.
- Replies are spoken as a **sequence of clips**: the text is split into sentence-sized segments of at most **280 characters** (`SPEECH_SEGMENT_MAX_CHARACTER_COUNT`, `src/voice/segment.ts`), and each segment is one `tts_start` → binary frames → `tts_end` run. `tts_start` therefore does **not** mean "the reply begins" — only `turn_end` closes a reply. Follow-up segments synthesize while the previous one plays.
- Binary frames are **8 192 bytes** (`TTS_STREAM_CHUNK_BYTE_LENGTH`), roughly 170 ms of audio each.
- Clip end is detectable two ways: count received bytes against `tts_start.bytes`, or wait for `tts_end`. `bytes` is optional in the schema but always sent when known — firmware before 2.7.0 treats a missing total as an empty run.
- **Pacing** (`src/voice/stream.ts`): the server sends the first **2 000 ms** at link speed (`TTS_STREAM_PREBUFFER_MILLISECONDS`; follow-up segments get only 500 ms since the device is still draining), then settles to ~playback pace (open-loop pace factor **0.85**), capping the modeled unplayed backlog at **4 000 ms** (`TTS_STREAM_MAX_BACKLOG_MILLISECONDS`). The reference device queues only ~6.8 s of frames and silently drops overflow — a client that buffers generously can ignore pacing entirely; a small-buffer client relies on it.
- **Closed loop (optional):** if the device sends `playback_ack` (~once per second) echoing the `sequence` from `tts_start` with `playedMilliseconds`, the server measures the backlog instead of modeling it. Absent acks, the open-loop pace stays in charge.

### Interruption

`abort` and `tts_aborted` are the two halves of barge-in:

1. Device sends `abort` (reference: a tap while speaking).
2. The server sets a flag; the paced loop checks it between chunks and stops sending within one chunk. The abort kills the **whole reply** — remaining segments are never synthesized.
3. The server sends `tts_aborted`. This is mandatory: `tts_start` promised a byte count the device is counting against, and that total will never arrive — without `tts_aborted` a byte-counting device waits forever. A new turn always clears the flag.

### `turn_end` and the mic

`turn_end.expectsReply` is the model's own judgment: the persona appends an `[[escucho]]` mark when its reply asks the user for something (a reply ending in `?` counts even without the mark — `src/turn/run.ts`); the mark is stripped before TTS. Policy for the device:

- `expectsReply: true` → reopen the mic after playback finishes.
- `expectsReply: false` → return to idle.
- Aborted speech always sends `false` — the user already cut it off.
- No `turn_end` received (old server) → fall back to reopening the mic.

**Announcements reuse the same vocabulary** (`src/agents/notify.ts`): a reminder or background result delivered while connected is a card message plus, unless focus suppresses it, a standard `tts_start` → PCM → `tts_end` → `turn_end { expectsReply: false }` run. Console broadcasts are the same pattern (chime + optional `reminder` card + TTS run, PCM owner-recorded for audio broadcasts). One playback path handles everything.

## Face: server owns meaning, device owns rendering

`ui_state.emotion` (`neutral`, `curious`, `focused`, `questioning`, `talking`, `calm`) and `ui_state.accentColor` are the entire expressive channel. Firmware must **not** keep its own state→expression table — read both straight off the wire, so the server can re-map states without a flash. Blinking/saccades stay autonomous on-device; there is **no amplitude or viseme channel** — derive mouth animation from the audio you are already playing. Mapping source: `src/persona/face.ts`; contract: `documentation/runtime/face.md`.

## MCP device bridge

`mcp` frames carry a raw JSON-RPC 2.0 object in `payload` and bridge server tools to the hardware. The server sends `tools/call` requests; the device routes them into its embedded MCP server and replies with a device→server `mcp` frame correlated by `id` — which **must be an integer**; the reference device silently drops string ids, and the schema enforces `z.number().int()` on both directions.

Tool menu called by the server (`src/tools/device.ts`, `src/ota/lifecycle.ts`):

| Device tool | Arguments | Exposure |
|-------------|-----------|----------|
| `self.audio_speaker.set_volume` | `{ volume: 0–100 }` | LLM tool `set_volume` |
| `self.screen.set_brightness` | `{ brightness: 0–100 }` | LLM tool `set_brightness` |
| `self.get_device_status` | `{}` | LLM tool `device_status` |
| `self.upgrade_firmware` | `{ url }` | Server-initiated OTA push only, never the LLM |
| `self.reboot` | — | Callable from server code, never the LLM |

Each call is awaited with a **5 000 ms** timeout (`DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS`, `src/mcp/bridge.ts`). Timeout degrades to the spoken result "El dispositivo no respondió a tiempo."; a JSON-RPC error becomes "El dispositivo rechazó la orden: …". A device without an MCP server can simply ignore `mcp` frames — every call degrades to a spoken failure, nothing hangs. (The same degradation philosophy covers the optional sandbox: without the `Sandbox` binding, coding tools answer with the spoken summaries in `src/sandbox/capability.ts`.)

## OTA over HTTP

Same `?token=<DEVICE_SHARED_SECRET>` as the WebSocket (it appears in device logs on both — an accepted exposure). Routes in `src/ota/routes.ts`, serving from the `MEDIA` R2 bucket:

- `GET|POST /ota/check` → `{ "firmware": { "version", "url", "force": 0 } }`, or `{}` when no manifest is published. The POSTed body (device system info) is ignored. `url` points at `/ota/firmware.bin` with the token already in the query. Versions are validated server-side against `/^\d+(\.\d+)*$/` because the reference version parser aborts on anything else.
- `GET /ota/firmware.bin` → the manifest's binary with an explicit `Content-Length` (the reference downloader refuses length-less responses).

The reference device checks once at boot after time sync; a failed check boots normally. The server can also **push**: on telemetry ticks it re-reads the manifest at most every 15 minutes (`FIRMWARE_PUSH_CHECK_INTERVAL_MS`, `src/ota/push.ts`; a charging edge forces a check) and calls `self.upgrade_firmware` over the MCP bridge only when *all* hold: the manifest version is newer than the reported `telemetry.firmwareVersion` (numeric per-segment compare, longer version wins a tie prefix — mirrors the reference parser exactly), UI state is `idle` or `dashboard`, no pending confirmation, no announcement in flight, focus inactive, and the device is charging or at ≥ 50 % battery (`FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT`). At most 3 attempts per version (`FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION`), 6-hour retry cooldown. The push URL uses the origin captured at connect — a device that never reported `firmwareVersion` is never pushed.

## Minimal client checklist

The smallest fully conversational client — screenless devices included — needs only:

**Send:** the token in the connect URL; `hold_start` → raw 16 kHz s16le mono binary frames (≥ 8 000 bytes total) → `hold_end`; `abort` for barge-in. That is the entire required uplink. `hello` and `telemetry` are recommended but not required for a turn to run.

**Handle:** `tts_start` (read `bytes`/`sampleRate`/`channels`) → play the binary frames → `tts_end`; `tts_aborted` → stop expecting the promised bytes and flush; `turn_end` → reopen the mic if `expectsReply`, else idle.

**Safely ignorable:** `ui_state`, `dashboard`, `timer`, `confirm_close`, `background_result`, `reminder` (their audio arrives separately as a normal TTS run), `play_effect`, `error`, and `mcp` (calls degrade to spoken failures after 5 s). A screenless device may also ignore `confirm_request` — the confirmation expires after 30 s and the tool is cancelled — but wiring `confirm { ok }` to a button makes side-effecting tools usable.

**Optional upgrades:** `playback_ack` for closed-loop pacing, `telemetry.firmwareVersion` + the OTA endpoints for updates, `gesture` frames for server-defined controls, an embedded MCP server for `self.*` tools.

And always: tolerate unknown message types and unknown optional fields.

## Device-agnostic vs reference board

Everything above is device-agnostic: any hardware that can hold a WebSocket, ship 16 kHz PCM up, and play 24 kHz PCM down is a full citizen. The reference implementation — https://github.com/galfrevn/apollo-firmware — targets one specific board, the Waveshare ESP32-S3 Touch LCD 1.85C V2 (round 360×360 touch LCD), and is where board-specific behavior lives: the ~6.8 s frame queue, gesture detection, the emote engine that renders `emotion`/`accentColor`, flash-baked earcons, and the OTA downloader whose quirks (integer JSON-RPC ids, the version regex, mandatory `Content-Length`) this contract encodes. The firmware adapts to Apollo, not the reverse: the server may grow the vocabulary; devices decide what it looks and sounds like.
