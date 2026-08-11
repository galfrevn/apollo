# Apollo Device Protocol — v1.0 (Draft)

The Apollo Device Protocol (ADP) is the wire contract between a **device** (any
client with a microphone and a speaker — an ESP32 on a desk, a browser tab, a
future board nobody has built yet) and an **agent** (an Apollo deployment running
on Cloudflare Workers). A device that implements this document can talk to any
compliant agent; an agent that implements it can serve any compliant device.

This specification covers exactly what travels over the wire. Everything else —
how the agent thinks, which tools it runs, how it is configured, what the
reference clients look like — is an implementation detail of one side or the
other and is deliberately out of scope. The test for whether something belongs
here: *does a device need to know this to talk to an agent?*

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

**Status: Draft.** This document describes the wire behavior of the current
reference implementation (`src/protocol/schema.ts` server-side,
`firmware/apollo-firmware` device-side), plus the version-negotiation fields
introduced by this spec. The deltas between this document and the shipped code
are listed in [Appendix B](#appendix-b--implementation-status).

## 1. Terminology

- **Device** — the client end of the connection: captures microphone audio,
  plays speech, renders UI state, reports input events.
- **Agent** — the server end: transcribes, reasons, synthesizes speech, and
  owns all interaction semantics.
- **Listen session** — the interval during which the device streams microphone
  audio: opened by `hold_start` or `wake`, closed by `hold_end`, `audio_end`,
  or `listen_cancel`.
- **Turn** — one round of interaction: an utterance (or `text_input`) in, a
  reply out. Runs when a listen session closes with usable audio.
- **Clip** — one contiguous run of downlink speech audio, announced by
  `tts_start` and delimited by its byte count. A reply may consist of several
  clips (one per sentence segment).
- **Control message** — a JSON object sent as a WebSocket text frame.
- **Audio frame** — a WebSocket binary frame carrying raw PCM.

## 2. Versioning and negotiation

The protocol version is `MAJOR.MINOR`.

- **MINOR** versions are additive: new message types, or new OPTIONAL fields on
  existing messages. A v1.x agent and a v1.y device always interoperate at
  min(x, y).
- **MAJOR** versions may change or remove existing semantics and are not
  interoperable without explicit support for both.

Negotiation is one-way and downward: the device declares, the agent adapts.

- The device SHOULD declare its protocol version in `hello.protocol` (e.g.
  `"1.0"`). An agent MUST treat a `hello` without a `protocol` field as a
  declaration of `1.0` — this retroactively makes all pre-spec firmware
  compliant.
- An agent MUST NOT send a message type introduced in a minor version later
  than the one the device declared.
- An agent SHOULD advertise the highest protocol version it speaks in its
  HTTP capability endpoint (see [§3.3](#33-capability-endpoint)) so that
  clients served from elsewhere (e.g. a hosted browser client) can detect
  skew before connecting.

Forward-compatibility rules, independent of negotiation:

- Receivers on both sides MUST tolerate unknown fields on known message types.
- A device MUST silently ignore control messages whose `type` it does not
  understand. (An agent MAY reject unknown device messages; the reference
  agent closes the message with a validation error and continues.)
- Enumerated string values that name device assets or renderings (sound effect
  names, emotions, UI states) may grow in minor versions; a device MUST treat
  an unknown value as a no-op or fall back to a neutral rendering, never
  disconnect.

## 3. Transport

### 3.1 Connection

The transport is a single WebSocket connection:

```
wss://<host>/agents/apollo/<deviceId>?token=<shared-secret>
```

- `<deviceId>` is a stable identifier chosen by the device (it doubles as the
  agent instance name under the Cloudflare Agents SDK routing scheme).
- `token` is a pre-shared secret. The agent compares it with a timing-safe
  check and rejects the connection with HTTP `401` before the WebSocket
  upgrade if it does not match. The `deviceId` is identification, not
  authentication — it grants nothing by itself.

After the socket opens, the device MUST send `hello` before any other message,
and SHOULD follow it with an initial `telemetry` snapshot.

### 3.2 Reconnection

The agent holds durable session state; the device holds none. A device SHOULD
reconnect automatically with backoff after a drop and MUST re-send `hello` (and
SHOULD re-send `telemetry`) on every new connection. An agent MUST tolerate
reconnects at any point, including mid-turn: a reply whose device vanished is
simply not delivered.

### 3.3 Capability endpoint

Agents SHOULD serve an unauthenticated HTTP endpoint at `GET /health`
returning a JSON object that includes at least:

```json
{ "ok": true, "name": "apollo", "protocol": "1.0" }
```

`protocol` is the highest ADP version the agent speaks. Clients distributed
separately from the agent (a hosted browser client, a firmware updater) SHOULD
check it before connecting and degrade gracefully on mismatch.

## 4. Framing

Every WebSocket **text frame** is one JSON control message with a required
`type` discriminator. Every **binary frame** is audio, and its meaning is fixed
by direction:

| Direction | Binary frame contents |
|---|---|
| device → agent | Microphone PCM belonging to the open listen session |
| agent → device | Speech PCM belonging to the clip announced by the last `tts_start` |

There is no framing header inside binary frames; ordering and adjacency carry
all the meaning. Consequently a device MUST NOT send microphone frames outside
a listen session, and an agent MUST NOT send speech frames outside an
announced clip.

All device → agent control messages carry `ts`: the device's timestamp in
milliseconds (non-negative integer). Agents treat `ts` as informational.

## 5. Audio

### 5.1 Uplink (microphone)

- Raw PCM, signed 16-bit little-endian, **16 000 Hz, mono**, no container.
- Streamed as binary frames while a listen session is open. Frame size is the
  device's choice; the agent concatenates everything between the session's
  opening and closing control messages into one utterance.
- The agent wraps the concatenated buffer server-side for transcription;
  devices never send WAV/RIFF headers.
- An utterance shorter than 8 000 bytes (¼ s) is rejected as too short: the
  agent responds with a spoken "I couldn't hear you" turn instead of running
  transcription. Devices SHOULD NOT try to enforce this locally.

### 5.2 Downlink (speech)

Speech is delivered as **clips**. For each clip the agent sends:

1. A `tts_start` control message announcing `format`, total `bytes`, and
   optionally `sampleRate` and `channels`.
2. The clip's binary frames, in order, totalling exactly `bytes`.

The device counts received bytes against the announced total to detect the end
of a clip; there is no trailing control message in the normal case. In the
reference implementation `format` is always `pcm`: raw signed 16-bit
little-endian, **24 000 Hz, mono** — chosen so a microcontroller needs no
decoder. Devices MUST support `pcm`; `mp3` and `wav` are reserved values a
device MAY reject by ignoring the clip.

Frames are paced by the agent (reference: 8 192-byte frames, throttled so the
device buffers a bounded backlog). Devices SHOULD start playback on the first
frame rather than waiting for the full clip.

If a clip is cancelled before its byte count completes, the agent MUST send
`tts_aborted` — otherwise the device would wait forever for bytes that are
never coming (see [§7.3](#73-barge-in)).

A multi-sentence reply is several consecutive clips, each with its own
`tts_start`. The device just plays clips in arrival order; it does not need to
know where replies begin. Where they *end* is signaled by `turn_end`
([§7.2](#72-turn-flow)).

## 6. Session and UI model

The agent owns all interaction semantics; the device is a terminal. This split
is load-bearing: gesture meanings, wake behavior, and state transitions can
change with a server deploy, never a reflash.

The agent drives the device's display through `ui_state`, whose `state` field
is one of:

| State | Meaning |
|---|---|
| `idle` | Nothing happening; default face |
| `listening` | A listen session is open; mic is hot |
| `thinking` | A turn is running |
| `speaking` | Clips are streaming or playing |
| `confirm` | A confirmation is pending ([§7.4](#74-confirmations)) |
| `focus` | Focus timer active; `focusRemainingSec` accompanies it |
| `dashboard` | Ambient clock/weather view; a `dashboard` payload precedes it |

`ui_state` also carries `speechMode` (an opaque display label for the active
persona mode), and optionally `caption` (text of what is being said),
`emotion` (see below), and `accentColor` (a CSS hex color for tinting the
face/UI). The device renders what it is told and keeps no state → expression
mapping of its own.

`emotion` is one of `neutral`, `curious`, `focused`, `questioning`, `talking`,
`calm`. Unknown emotions render as `neutral`.

## 7. Interaction flows

### 7.1 Listen sessions

Two ways to open, matched ways to close:

- **Push-to-talk**: `hold_start` opens; `hold_end` closes and runs the turn.
- **Wake**: `wake` opens (wake-word or equivalent trigger detected on-device);
  `audio_end` closes when the device's VAD decides the utterance is over, and
  runs the turn.

Either kind may instead close with `listen_cancel` (e.g. a tap while
listening): the agent discards buffered audio and no turn runs.

The open/close pairing is meaningful even though both paths currently run the
same turn logic: it lets the agent apply different timeout or continuity
policies per style without a device change. Devices MUST close a session with
the event matching how it was opened.

`text_input` bypasses audio entirely: it runs a turn on the given text with no
listen session involved.

### 7.2 Turn flow

The canonical voice turn:

```
device                          agent
  │  hold_start / wake            │
  │ ─────────────────────────────▶│   ui_state: listening
  │  ~~~ mic PCM frames ~~~       │
  │  hold_end / audio_end         │
  │ ─────────────────────────────▶│   ui_state: thinking
  │                               │   (transcribe → reason → synthesize)
  │◀───────────────────────────── │   ui_state: speaking (+ caption)
  │◀───────────────────────────── │   tts_start { bytes: N }
  │  ~~~ speech PCM frames ~~~    │
  │◀───────────────────────────── │   (more tts_start + frames per segment)
  │◀───────────────────────────── │   turn_end { expectsReply }
  │◀───────────────────────────── │   ui_state: idle | focus | dashboard
```

`turn_end` means the turn's speech has been *fully sent* (not necessarily
fully played). Its `expectsReply` field is the agent's judgment of whether its
reply asked the user something:

- `expectsReply: true` — the device SHOULD reopen the microphone (a wake-style
  listen session) after playback finishes.
- `expectsReply: false` — the device SHOULD return to its resting state.

Aborted replies and one-way announcements (reminders, background results)
always carry `expectsReply: false`. If a device never receives `turn_end`
(pre-spec agent), it MAY fall back to always reopening the mic.

### 7.3 Barge-in

Speech is cancellable mid-reply:

1. Device sends `abort` (reference trigger: a tap while `speaking`).
2. The agent stops sending frames at the next pacing boundary and discards the
   rest of the reply — remaining segments are never synthesized.
3. The agent sends `tts_aborted`, releasing the device from the byte count
   promised by the last `tts_start`.
4. `turn_end { expectsReply: false }` follows.

An abort ends the whole reply, not just the current clip. A new turn always
clears the abort, so it cannot leak into the next reply.

### 7.4 Confirmations

When a turn wants explicit user approval for a side effect:

1. Agent sends `confirm_request { id, summary, expiresAt }` and `ui_state:
   confirm`. The device SHOULD display the summary and offer accept/reject
   affordances.
2. Device answers with `confirm { ok }`.
3. Agent closes the exchange with `confirm_close { id, reason }` — `resolved`
   (answered), `expired` (the deadline passed), or `orphaned` (the waiting
   turn is gone). On `confirm_close` the device MUST drop its confirm UI.

### 7.5 Gestures

The device reports physical gestures verbatim — `tap`, `double_tap`,
`swipe_left`, `swipe_right` — and attaches no local meaning to them. All
gesture semantics live in the agent (reference mapping: tap toggles the
dashboard or aborts speech contextually, swipes cycle the speech mode,
double_tap is reserved). Remapping a gesture is an agent deploy, never a
reflash.

### 7.6 Unsolicited messages

Outside any turn, the agent may push at any time:

- `reminder { message }` — a due reminder; the agent follows with spoken
  delivery as a normal clip sequence.
- `background_result { summary, prompt, documentKey? }` — async work
  completed.
- `dashboard { clock, weather }` — sent on connect, when the dashboard opens,
  and periodically while it is displayed.
- `play_effect { name }` — see below.
- `ui_state` — state changes originating server-side (focus ticks, mode
  changes).

`play_effect` names a sound the device has locally (`ding`, `chime`, `error`,
`low_battery`); the device maps names to its own assets and MUST ignore
unknown names (log-and-drop). The point of effects is latency and cost: an
earcon plays instantly while TTS is still synthesizing, from flash, for free.

## 8. Message reference — device → agent

Every message includes `type` and `ts` (integer, ms, non-negative). Fields
listed are in addition to those.

### `hello`
Identify the device. MUST be the first message on every connection.

| Field | Type | Req | Meaning |
|---|---|---|---|
| `deviceId` | string | yes | Stable device identifier; matches the URL path segment |
| `protocol` | string | no | Declared ADP version; absent ⇒ `"1.0"` |

```json
{ "type": "hello", "deviceId": "desk-01", "protocol": "1.0", "ts": 1723400000000 }
```

### `hold_start` / `hold_end`
Open / close a push-to-talk listen session. No extra fields.

### `wake`
Open a wake-style listen session (wake word or equivalent detected
on-device). No extra fields.

### `audio_end`
Close a wake-style listen session; the device's VAD judged the utterance
complete. Runs the turn. No extra fields.

### `listen_cancel`
Close the open listen session and discard its audio; no turn runs. No extra
fields.

### `gesture`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `gesture` | enum | yes | `tap` \| `double_tap` \| `swipe_left` \| `swipe_right` |

### `confirm`
Answer a pending `confirm_request`.

| Field | Type | Req | Meaning |
|---|---|---|---|
| `ok` | boolean | yes | Accept (`true`) or reject (`false`) |

### `text_input`
Run a turn on typed text; no listen session involved.

| Field | Type | Req | Meaning |
|---|---|---|---|
| `text` | string | yes | Non-empty input text |

### `abort`
Cancel the reply currently streaming ([§7.3](#73-barge-in)). No extra fields.

### `telemetry`
Device vitals snapshot. Sent after connect, every 60 s, and immediately on a
charging-state edge. Every field is OPTIONAL — a device omits what its
hardware cannot measure.

| Field | Type | Meaning |
|---|---|---|
| `battery` | int 0–100 | Charge percentage |
| `charging` | boolean | Charging state (may be estimated) |
| `volume` | int ≥ 0 | Speaker volume |
| `wifiRssi` | int | Signal strength, dBm |
| `firmwareVersion` | string | Device software version |

```json
{ "type": "telemetry", "battery": 82, "charging": false, "wifiRssi": -54,
  "firmwareVersion": "1.4.2", "ts": 1723400060000 }
```

### `mcp`
JSON-RPC **response** from the device's embedded MCP server
([§10](#10-device-control-bridge-mcp)).

| Field | Type | Req | Meaning |
|---|---|---|---|
| `payload.jsonrpc` | `"2.0"` | yes | JSON-RPC version |
| `payload.id` | integer | yes | Correlates with the request |
| `payload.result` | any | no | Success result |
| `payload.error` | object | no | `{ code?, message }` on failure |

## 9. Message reference — agent → device

### `ui_state`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `state` | enum | yes | See [§6](#6-session-and-ui-model) |
| `speechMode` | string | yes | Opaque display label of the active mode |
| `caption` | string | no | Text being spoken |
| `focusRemainingSec` | int ≥ 0 | no | Present in `focus` state |
| `emotion` | enum | no | Face expression; unknown ⇒ `neutral` |
| `accentColor` | string | no | CSS hex color, e.g. `"#F5C518"` |

```json
{ "type": "ui_state", "state": "speaking", "speechMode": "casual",
  "caption": "Son las cuatro y media.", "emotion": "talking",
  "accentColor": "#F5C518" }
```

### `confirm_request`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | yes | Confirmation identity |
| `summary` | string | yes | Human-readable description of the side effect |
| `expiresAt` | int | yes | Epoch ms deadline (reference: 30 s window) |

### `confirm_close`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `id` | string | yes | The confirmation being closed |
| `reason` | enum | yes | `resolved` \| `expired` \| `orphaned` |

### `tts_start`
Announces the next clip ([§5.2](#52-downlink-speech)).

| Field | Type | Req | Meaning |
|---|---|---|---|
| `format` | enum | yes | `pcm` \| `mp3` \| `wav` (reference always sends `pcm`) |
| `bytes` | int ≥ 0 | yes | Exact byte length of the clip's binary frames |
| `sampleRate` | int > 0 | no | Reference: `24000` |
| `channels` | int > 0 | no | Reference: `1` |

### `tts_aborted`
The announced clip was cancelled and its byte count will never complete. No
fields.

### `turn_end`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `expectsReply` | boolean | yes | Reopen the mic after playback? ([§7.2](#72-turn-flow)) |

### `error`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `code` | string | yes | Machine-readable failure identifier |
| `message` | string | yes | Human-readable description |

Error codes are agent-defined strings; devices MUST NOT hard-code against the
set beyond logging/decoration and MUST keep the connection open.

### `dashboard`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `clock.timezone` | string | yes | IANA timezone |
| `clock.isoNow` | string | yes | Current time, ISO 8601 |
| `weather.locationLabel` | string | yes | Display name |
| `weather.temperatureC` | number | yes | Temperature, °C |
| `weather.conditionLabel` | string | yes | Display condition |
| `weather.updatedAt` | string | yes | ISO 8601 snapshot time |

### `background_result`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `summary` | string | yes | Spoken/displayed result summary |
| `prompt` | string | yes | The originating request |
| `documentKey` | string | no | Storage key of a full result document |

### `reminder`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `message` | string | yes | The reminder text |

### `play_effect`

| Field | Type | Req | Meaning |
|---|---|---|---|
| `name` | enum | yes | `ding` \| `chime` \| `error` \| `low_battery`; unknown ⇒ ignore |

### `mcp`
JSON-RPC **request** to the device ([§10](#10-device-control-bridge-mcp)).

| Field | Type | Req | Meaning |
|---|---|---|---|
| `payload.jsonrpc` | `"2.0"` | yes | JSON-RPC version |
| `payload.id` | integer | yes | Correlation id — MUST be an integer |
| `payload.method` | string | yes | e.g. `tools/call` |
| `payload.params` | object | no | Method parameters |

## 10. Device control bridge (MCP)

`mcp` frames tunnel [JSON-RPC 2.0](https://www.jsonrpc.org/specification)
between the agent and an MCP server embedded in the device, letting agent
tools reach hardware controls (reference tools: `self.audio_speaker.set_volume`,
`self.screen.set_brightness`, `self.get_device_status`).

- Direction: agent sends requests, device sends responses. Correlation is by
  `id`, which MUST be an integer — the reference firmware silently drops
  string ids.
- The agent awaits each call with a timeout (reference: 5 s). Timeout or a
  disconnected device degrades to a graceful spoken failure, never a crash.
- Devices without controllable hardware MAY ignore `mcp` requests entirely;
  agents MUST tolerate the resulting timeout.
- The set of tools a device exposes is its own; agents SHOULD discover rather
  than assume, and MUST NOT expose destructive device tools (reboot, firmware
  upgrade) to model-initiated calls.

## 11. Conformance

Two conformance classes, so a weekend project and a full desk build both have
a defined target.

### 11.1 Minimal client

The smallest thing that can talk to an agent (e.g. a browser tab with
push-to-talk):

- Connect with `token`, send `hello` (with `protocol`)
- Open/close listen sessions with `hold_start`/`hold_end` **or** send
  `text_input`
- Stream uplink PCM per [§5.1](#51-uplink-microphone)
- Play `pcm` clips per [§5.2](#52-downlink-speech), honoring `tts_start`
  byte counts and `tts_aborted`
- Render or at least tolerate `ui_state`; act on `turn_end.expectsReply`
- Ignore every message type it does not implement

### 11.2 Full desk device

Everything above, plus:

- Wake-style sessions (`wake`/`audio_end`) with on-device wake detection and
  VAD, and `listen_cancel`
- `gesture` reporting and `abort` barge-in
- `confirm` / confirm UI
- `telemetry` at the specified cadence
- `play_effect` with local assets
- The MCP bridge with at least `self.get_device_status`
- `dashboard`, `reminder`, `background_result` renderings

## Appendix A — OTA endpoints (informative)

The reference agent also serves two token-authenticated HTTP routes for
firmware updates (same `?token=` secret as the WebSocket). These are specific
to flash-based devices and are not part of core ADP conformance:

- `GET|POST /ota/check` → `{ "firmware": { "version", "url", "force" } }`, or
  `{}` when nothing is published. Versions match `/^\d+(\.\d+)*$/`.
- `GET /ota/firmware.bin` → the current binary, always with an explicit
  `Content-Length`.

The reference device checks once at boot, after time sync; a failed check
logs and boots normally.

## Appendix B — Implementation status

Deltas between this draft and the shipped reference implementation:

| Spec item | Status |
|---|---|
| `hello.protocol` field | Shipped — `src/protocol/schema.ts`, resolved in `src/protocol/version.ts` |
| `/health` `protocol` advertisement | Shipped — `src/index.ts` |
| Everything else in this document | Shipped and observable on the wire today |

## Changelog

- **1.0 (draft)** — first written version of the contract; documents the wire
  behavior shipped as of 2026-08 and introduces version negotiation.
