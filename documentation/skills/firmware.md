---
name: apollo-firmware
description: Build a body for Apollo — write firmware or any client (a different ESP32 board, a screenless speaker, a button instead of touch, a Python or desktop client) that talks to the Apollo worker. Use when porting to new hardware, implementing mic/speaker/wake/telemetry/OTA on a device, or validating a client against the simulator before hardware exists.
---

# Building a body for Apollo

Doctrine: **the firmware adapts to Apollo, never the reverse.** The worker's wire contract is fixed; every body — whatever its hardware — implements some subset of it. The reference implementation is https://github.com/galfrevn/apollo-firmware, firmware for one specific board (Waveshare ESP32-S3 Touch LCD 1.85C V2). It is a reference, not a dependency: nothing in this starter requires that board, that screen, or a screen at all.

The full wire contract (every message, every field) lives in the `apollo-protocol` skill (`.claude/skills/apollo-protocol`) and `documentation/runtime/protocol.md`; the executable truth is `src/protocol/schema.ts`. This skill does not repeat those tables — it tells you which subset to implement and in what order.

## Transport basics

- Connect: `wss://<host>/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`. The token rides in the query string on both the websocket and the OTA routes (an accepted exposure; it appears in device logs).
- Control messages are JSON text frames, validated with Zod on the server — **strict on device→server** (send exactly the schema; unknown types or bad fields fail parse). Every device message carries `ts` (nonnegative integer); `hello` also carries `deviceId`.
- Server→device: the client must **tolerate unknown message types and absent optional fields**. Optional fields stay optional — missing caption, emotion, accentColor, focus seconds are normal.
- Audio rides alongside as raw binary frames, no JSON wrapper, direction inferred from context (uplink while listening, downlink inside a `tts_start` run).

## The hardware interview

Before writing a line of client code, interview the human. Each answer selects the wire subset:

| Question | If yes | If no |
|---|---|---|
| Microphone? | One listen entry path + binary PCM uplink (s16le, 16 kHz, mono) | `text_input` is the only input |
| Speaker? | `tts_start`/PCM/`tts_end` playback at 24 kHz, `tts_aborted`, `play_effect`, pacing (acks or deep buffer) | Read `ui_state.caption`; still drain and discard binary frames; still honor `turn_end` |
| Screen? | `ui_state` rendering, captions, face emotion/accent, `dashboard`, `timer` arc, `confirm_request` UI, `reminder`/`background_result` cards | Ignore all of it (see "Screenless" below) |
| Touch / buttons? | `gesture` events, tap-to-abort, tap-to-cancel-listen, `confirm` answers | No gestures; confirmations expire server-side (`confirm_close` reason `expired`) |
| Wake stack: hold-to-talk? | `hold_start` / `hold_end` around the press | — |
| Wake stack: wake word? | `wake` to open the mic, `audio_end` when your own VAD detects end of utterance | — |
| Battery / charging sensing? | `telemetry.battery` / `telemetry.charging` | Omit those fields — every telemetry field is per-field optional |
| Adjustable volume / brightness? | Implement the device MCP bridge (`self.*` tools) | Skip the bridge; server tool calls degrade to a spoken "no respondió" |
| Flashable / self-updating? | OTA pull at boot; report `firmwareVersion` in telemetry to enable server push | Skip OTA entirely |

Pick exactly ONE listen entry path to start: `hold_start`/`hold_end`, or `wake`/`audio_end`, or `text_input` only. A listen session ends with the event matching how it started.

## The minimal-client ladder

**Rung 0 — converses (the absolute minimum):**

1. Connect with the token; send `hello { deviceId, ts }`.
2. One listen path. For audio paths: stream mic audio as binary frames of raw s16le 16 kHz mono PCM between the start event and the end event. The server discards turns under 8000 bytes (a quarter second) as an accidental press.
3. Play downlink speech: each segment arrives as `tts_start` (format `pcm` in production, 24 000 Hz mono s16le — no decoder needed) followed by binary frames in ~8192-byte chunks (~170 ms each). Count bytes against `tts_start.bytes` when present; treat `tts_end` as the authoritative close of a run. A reply is a *sequence* of these runs, one per sentence segment — `tts_start` is not "the reply begins".
4. Honor `tts_aborted`: the announced clip was cut short and its byte total will never arrive — stop waiting, flush, return to idle. Without this you hang forever after any barge-in.
5. Honor `turn_end.expectsReply`: `true` → reopen the mic after playback finishes; `false` → idle. If no `turn_end` arrives (old server), fall back to reopening the mic.
6. Tolerate unknown server message types and absent optional fields. Silently ignoring is correct.

That is a complete conversational body. Everything below is optional rungs, each independent:

- **Gestures** — send `gesture` with `tap` / `double_tap` / `swipe_left` / `swipe_right`. Meaning lives on the server (tap toggles the dashboard, swipes cycle the speech mode, `double_tap` is deliberately a no-op). Two contextual exceptions the client resolves itself: a tap *while Apollo is speaking* is sent as `abort` (barge-in), a tap *while listening* is sent as `listen_cancel` (discard the open session, no turn runs).
- **Telemetry** — send `telemetry` right after connect, then every 60 seconds, and immediately on a charging edge. Every payload field (`battery` 0–100 int, `charging`, `volume`, `wifiRssi`, `firmwareVersion`) is optional; omit what the hardware cannot measure. The server stamps a fresh snapshot (≤5 min old) into the prompt and announces low battery at ≤15% (30-min cooldown, re-armed by charging or recovery to 25%).
- **Confirm flow** — render `confirm_request { id, summary, expiresAt }`, answer with `confirm { ok, ts }`, drop the screen on `confirm_close { id, reason: resolved | expired | orphaned }`.
- **ui_state rendering** — `state` is one of `idle | listening | thinking | confirm | speaking | focus | dashboard`; also carries `speechMode`, optional `caption`, `focusRemainingSec` / `focusStartedAt` / `focusEndsAt` (epoch seconds — pushes are event-driven, count down locally between them), `emotion`, `accentColor`.
- **Dashboard** — render `dashboard { clock: { timezone, isoNow }, weather: { locationLabel, temperatureC, conditionLabel, updatedAt } }`.
- **Timer arc** — `timer { endsAt?, durationSeconds? }`, epoch seconds; both fields absent means clear whatever arc is showing.
- **play_effect earcons** — four logical names: `ding` (timer/reminder landing), `chime` (confirmation request, broadcasts), `error` (turn failure), `low_battery`. The client maps names to local assets; log and ignore unknown names. Purpose is latency: the earcon plays instantly while TTS is still synthesizing.
- **playback_ack** closed-loop pacing — see next section.
- **Device MCP bridge** — see below.
- **OTA** — see below.

## Screenless devices

A device with no screen ignores, entirely and safely: `ui_state`, `dashboard`, `timer`, `confirm_request` rendering (let confirmations expire; `confirm_close` needs no action), `reminder` and `background_result` cards, `emotion`, `accentColor`, captions. None of these gate the conversation. A mic, a speaker, and rung 0 fully converse.

## Face and mouth (if you have a display)

- `ui_state.emotion` and `ui_state.accentColor` arrive on the wire; the client renders them. Do **not** keep a client-side state→expression lookup table — the server owns meaning, the device owns rendering. Vocabulary today: `neutral`, `curious`, `focused`, `questioning`, `talking`, `calm`.
- Blinking and saccades are autonomous on-device; the server never sends blink events, only mood.
- **There is no viseme or amplitude channel.** Derive mouth/talk animation from the audio the client is already playing (e.g. RMS of the PCM in the output buffer). And since a reply is many `tts_start` runs, do not key "mouth open" off `tts_start` — key it off actual playback.

## Downlink pacing: acks vs a deep buffer

The server streams TTS at roughly playback pace: a 2 s prebuffer burst, then a 0.85 pace factor, with the unplayed backlog capped at 4 s (`TTS_STREAM_MAX_BACKLOG_MILLISECONDS = 4000` in `src/voice/stream.ts`). Two ways to be a good citizen:

1. **Closed loop (preferred):** send `playback_ack { sequence, playedMilliseconds, ts }` about once per second while playing — `sequence` echoes the `tts_start.sequence` of the clip being played, `playedMilliseconds` is the playback position within that clip. The server then measures the backlog instead of modeling it. (The reference firmware sends acks from 2.7.0.)
2. **Buffer deep:** no acks needed if the client can hold **at least ~5 s of downlink audio** (24 kHz s16le mono ≈ 48 kB/s, so ~240 kB). The open-loop pace keeps the modeled backlog ≤ 4 s plus network slack; the reference firmware's ~6.8 s queue (40 packets × ~170 ms) is comfortable. A shallower buffer silently drops overflow and clips the tail of long replies.

## Device MCP bridge (`mcp` frames)

Server→device `mcp` frames carry a raw JSON-RPC 2.0 object in `payload`; the client routes `tools/call` into an embedded MCP server and replies with a device→server `mcp` frame. Rules:

- Correlation is by JSON-RPC `id`, which **must be an integer** — the schema rejects string ids because the reference device silently drops them.
- The server awaits each call with a 5-second timeout (`DEVICE_TOOL_CALL_TIMEOUT_MILLISECONDS` in `src/mcp/bridge.ts`); a timeout degrades to a spoken failure, so an unimplemented bridge is safe, just mute.
- Tools the LLM calls: `self.audio_speaker.set_volume`, `self.screen.set_brightness`, `self.get_device_status`. Implement the ones your hardware supports.
- User-only tools, callable from server code but never exposed to the LLM: `self.reboot`, `self.upgrade_firmware` (the vehicle for OTA push).

## OTA

**Pull (device-initiated, once at boot after time sync; a failed check boots normally):**

- `GET|POST /ota/check?token=<secret>` → `{ "firmware": { "version", "url", "force" } }` or `{}` when no manifest is published. The `url` already carries the token. Versions are validated server-side against `/^\d+(\.\d+)*$/` (the reference parser runs `std::stoi` per dot-segment and aborts on anything else — keep your parser at least that tolerant).
- `GET /ota/firmware.bin?token=<secret>` → the binary, always with explicit `Content-Length` (sent because the reference device refuses length-less downloads).
- Version comparison, if you implement it: numeric per dot-segment; on a tie prefix the longer version wins (`"2.6.0" > "2.6"`). The server mirrors this exactly (`compareFirmwareVersions` in `src/ota/push.ts`).

**Push (server-initiated):** the server checks the manifest every 15 minutes and on charging edges, and calls `self.upgrade_firmware { url }` over the MCP bridge — but only when *all* preconditions hold: the device has reported `firmwareVersion` in telemetry, the manifest version is strictly newer, UI state is `idle` or `dashboard`, no pending confirmation, no announcement in flight, no focus session, and power is safe (charging, or battery ≥ 50%). Max 3 attempts per manifest version, 6-hour retry cooldown. So: a client that wants push updates must (a) send `firmwareVersion` in telemetry and (b) implement `self.upgrade_firmware` on its bridge. Publishing is just two R2 objects: the binary plus `firmware/latest.json` (`{ version, key, changelog? }`).

## Simulator: validate before hardware exists

Deploy (or `wrangler dev`) with the `MOCK_VOICE=1` var. Then:

- STT is mocked: an audio turn transcribes to the turn's text if present, else `'hola'`.
- The LLM is mocked: the reply is `Mock: <user text>`.
- TTS "audio" is the **UTF-8 bytes of the reply text** — so your client's byte-counting, `tts_end` handling, and abort logic all exercise for real, and you can assert on the decoded bytes instead of listening.

`scripts/probe.ts` is a working reference client:

```
bun run probe -- --url wss://<host>/agents/apollo/desk --token <secret> --text "hola"
```

To fake mic input at the protocol level (no microphone involved): send `hold_start`, then binary frames of s16le 16 kHz mono PCM (any ≥8000 bytes — even generated silence-plus-tone — since MOCK_VOICE never transcribes it), then `hold_end`. The full listen→turn→TTS-run→`turn_end` cycle runs against your client exactly as it will with real voice.

## Porting workflow

Climb the ladder one rung at a time, testing each against a live worker with `wrangler tail` open in a second terminal — the worker logs structured JSON for parse failures, turn stages, and MCP timeouts, which is where client bugs surface first.

1. **Text only.** Connect, `hello`, `text_input`, print incoming messages raw. Proves auth, transport, and JSON framing. (With `MOCK_VOICE=1`, the reply's PCM decodes to readable text.)
2. **Audio up.** Add one listen path and PCM uplink. Verify in `wrangler tail` that turns run and byte counts look sane; a turn that never runs usually means <8000 bytes or a missed end event.
3. **Audio down.** Play the `tts_start`/PCM/`tts_end` runs. Get abort right *now* — send `abort` mid-reply and confirm `tts_aborted` unblocks your byte counter. Choose acks or the deep buffer.
4. **Niceties, in whatever order the hardware suggests:** gestures, telemetry, confirm flow, rendering, earcons, MCP bridge, OTA. Each rung is independently shippable; the device is a full body at every step.
