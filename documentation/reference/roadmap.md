# Roadmap

Status as of 2026-08-10. Items under **Confirmed** are already decided; the detail under each one says which side it touches — server, firmware, or both. Spoken examples stay in Rioplatense Spanish because that is what a user literally says to the device.

## Confirmed

### 1. Focus mode visible on screen

The server already tracks `focus` state and sends `focusRemainingSec` on every `ui_state`, but the device only shows the "sleepy" face (via emotion) — there is no visible countdown.

- **Firmware**: render the remaining time. Candidates are a progress arc over the accent ring, or the center label of the emote engine. Parse `focusRemainingSec` in `HandleUiState` (`apollo_protocol.cc`).
- **Server**: done — only the refresh cadence of the field needs verifying.

### 2. Complete background result: document QR

- **Spoken notice**: ✅ done. `deliverDeskDeviceNotification` (`src/agents/notify.ts`) synthesizes and paces TTS for both `background_result` and `reminder`, queues them as pending messages when nobody is connected, and stays quiet during focus. What is left is cosmetic: the announcement speaks the summary directly rather than framing it ("terminé \<task\>: …").
- **QR on screen**: when a `documentKey` is present, show a QR with the document URL. The gfx engine already has a QR widget (`emote_set_qrcode_data` in `emote_op.c`), so the firmware only needs to route a new message (say `"type": "qr"`) through to that widget, with an auto-close timeout. The reports are already emailed in parallel, so the QR is a convenience, not the only way to reach one.

### 3. Device → server telemetry + agent reactions — ✅ shipped 2026-08-10

`{"type":"telemetry", battery, charging, volume, wifiRssi, firmwareVersion, ts}` goes out on channel open, every 60 s, and immediately on a charging edge. The server keeps the snapshot in memory, stamps it into the system prompt while fresh, and announces low battery (≤15%, 30 min cooldown, hysteresis at 25%) piercing focus as `critical`. Battery sensing required wiring `AdcBatteryMonitor` into the 1.85C board — the schematic puts BAT_ADC on GPIO8 through a 200K/100K divider; there is no charge-status GPIO, so charging is the estimation library's voltage-trend guess. See `src/telemetry/logic.ts` and `Application::MaybeSendTelemetry`.

### 4. Semantic `audio_end` — ✅ shipped 2026-08-10

The firmware now remembers which mode started the listen (`listen_started_by_hold_` in `apollo_protocol.cc`) and ends it with the matching event: `hold_end` for push-to-talk, `audio_end` for wake-word turns. The server dispatches them as separate cases (identical behavior today) so timeouts or continuity can diverge without a flash.

### 5. Device-side MCP: the agent with hands on the hardware — ✅ implemented 2026-08-10 (pending flash)

Both ends are connected: `apollo_protocol.cc` routes `"mcp"` frames into the live `application.cc` branch (and overrides `SendMcpMessage` to speak the Apollo dialect: `{"type":"mcp","payload",…,"ts"}`), and the server bridges agent tools to the embedded MCP over the websocket (`src/mcp/bridge.ts`: integer JSON-RPC ids, 5 s timeout awaited inside the tool handler). Exposed to the LLM as `set_volume`, `set_brightness`, and `device_status` (`src/tools/device.ts`); the device's user-only tools (`self.reboot`, `self.upgrade_firmware`) stay callable from server code but hidden from the model. "Apagá la pantalla" and face control need tools the 1.85C build compiles out — a later firmware addition.

### 6. Voice timer with ring progress — server half ✅ (2026-08-08)

"Poné 10 minutos" → the agent creates the timer and the ring turns into a circular progress bar: it starts full in the mode's color and drains (or fills) until the end, with a sound on completion.

- **Server**: ✅ `set_timer` and `start_pomodoro` are in production, mounted on the reminder scheduler; the pomodoro also activates focus. All that is missing is the message to the device carrying duration/remaining so it can draw the arc.
- **Firmware**: the accent ring overlay is already drawn chunk by chunk in `emote_display.cc`; generalize it to a partial arc with the angle as a function of progress. The same UI serves the focus-mode countdown from item 1.

### 7. Live captions (cleared when the turn ends)

Show what the user is saying while they speak, using partial streaming STT, and clear the text as soon as the turn ends so the screen goes back to just the face.

- **Server**: transcription is post-hold today (`src/voice/stt.ts`); this needs streaming STT over the chunks already arriving on the WebSocket, plus an incremental caption message.
- **Firmware**: render partial captions (the `sentence_start` path already exists) and clear explicitly on end of turn.

### 8. Conversation continuity

A window of roughly 10 s after a reply during which the user can follow up with no wake word and no hold: the mic reopens by itself and the ring pulses to signal it.

- **Firmware**: after `speech_done`, re-enter listening with VAD and a short timeout; a ring "pulse" animation indicates the open mic.
- **Server**: accept a turn that arrives with no preceding `hold_start`/`wake` inside the window; close the window on silence or on "gracias"/"listo".

### 9. Touch reactions on the face

Touching the eyes or other zones of the face triggers an immediate reaction — a blink, surprise, annoyance if the user keeps at it. Pure firmware, no server: map touch zones (`esp_lcd_touch_cst9217`) to catalog emotes with a small cooldown and escalation on repeats.

### 10. Background moods

The idle face should not always be neutral: subtle variation by time of day and last interaction (sleepier at night, more awake in the morning, "happy" for a while after a long chat).

- **Firmware**: can be resolved entirely locally (clock + last turn), or
- **Server**: by sending the idle emotion in `ui_state` so the agent can influence it too — for example staying "curious" after an open-ended question.

## Proposed 2026-08-08: more server ↔ firmware interaction

Guiding principle: the firmware only gains **vocabulary** — new protocol events and commands — while the semantics always live in the server, which deploys in seconds.

Suggested first round: 12, plus the telemetry from item 3. Both fit in a single flash and each one unblocks immediate server-side features. Second round: 14 (OTA), so that becomes the last flash over cable.

### 11. Gestures as raw events — ✅ already shipped

The pattern landed: the firmware emits `{"type":"gesture","gesture":"tap"|"double_tap"|"swipe_left"|"swipe_right","ts":…}` from the touch driver with no local semantics, and the server decides what each one means in `#handleGesture` (`src/agents/apollo.ts`) — tap toggles the dashboard, swipes cycle the speech mode. Remapping is a worker deploy, not a flash.

Touch barge-in shipped alongside it, through a dedicated `abort` message rather than a gesture: a tap while Apollo is speaking stops the stream within a chunk and the server answers `tts_aborted`.

Still open: `long_press` is not in the gesture enum, so "hold to start a pomodoro or a briefing" needs one enum entry on each side.

### 12. Server-triggered earcons (`play_effect`) — ✅ shipped 2026-08-10

`{"type":"play_effect", "name":"ding"|"chime"|"error"|"low_battery"}` plays effects already burned into flash. The names are logical — the firmware maps them to assets (`ding`→success, `chime`→popup, `error`→exclamation) so the server can re-purpose sounds without a flash. Wired at three sites: reminder/timer delivery (the ding lands while the TTS is still synthesizing), confirm requests, and turn failures, plus the low-battery announcement from item 3.

### 13. `set_volume` from the server — ✅ implemented 2026-08-10 via item 5

Came for free through the MCP bridge, as predicted: `set_volume` is one of the three tools item 5 exposes to the agent.

### 14. OTA from R2 — ✅ implemented 2026-08-10 (pending the last cable flash)

The worker serves `/ota/check` and `/ota/firmware.bin` from the `MEDIA` bucket (`src/ota/`, token-authenticated, versions strictly `digits.and.dots` because the device's parser aborts on anything else). The device (2.5.0) checks once at boot right after time sync — single attempt, a failed check never blocks boot — and self-updates through the existing `esp_ota` path; `MarkCurrentVersionValid` now runs under Apollo so rollback no longer reverts OTA'd images. Publishing steps live in [Deploy](../operations/deploy.md#publishing-firmware-ota). Remaining: deploy the worker, upload 2.5.0 + manifest, one last cable flash; from then on firmware "deploys" too. Push-style updates (server calls `self.upgrade_firmware` over the item-5 bridge when telemetry shows a stale version) are the documented follow-up for devices that never reboot.

### 15. `tts_end` + playback acks (real streaming)

The two pieces currently blocking end-to-end streaming:

- **`tts_end`**: removes the requirement to know total `bytes` up front in `tts_start`, so the server could start sending ElevenLabs audio while it is still being synthesized. Sentence segmentation already delivers about 80% of the benefit; this captures the rest.
- **Acks**: a periodic "I have played X ms" message, so the server's pacing (`src/voice/stream.ts`) stops estimating the backlog with an open-loop model and uses the device queue's real state instead. Robust on any WiFi, and it replaces the fixed 4 s cap.

### 16. Typed on-screen cards (`ui_card`)

Beyond face + caption: a circular timer countdown (which merges with item 6), weather with an icon, the dollar rate, the grocery list while it is being read out. Typed and bounded — timer, weather, list, rate, QR (the QR is already in item 2) — with no arbitrary layouts. The discarded dashboard ("dashboard has no UI yet") would come back in through here.

## Under consideration (ideas, no commitment)

- **Clock + weather dashboard on tap**: the server half is done — a tap while idle enters `dashboard` state and pushes the payload, then refreshes it every 30 minutes for as long as that state holds. The firmware still discards it ("dashboard has no UI yet"), so tapping shows nothing. If item 16 lands, this becomes just another card.
- **Voice barge-in**: interrupting the assistant by *talking* over it. Untested; the raw mic path has no AEC (see the wake word notes). Touch barge-in already works (item 11), so this is only about the hands-free case.
- **Morning briefing**: weather plus the day's reminders by voice at a fixed hour, orchestrated on top of the existing reminder cron.
- **Night mode**: minimum brightness, quieter effects, and silenced notifications within an hour range — a natural fit on top of MCP + telemetry.
- **Web session console**: a page served by the worker with transcripts, tool calls, and errors, for debugging without serial.
- **Multi-device**: the protocol already routes by `device_id`; formalize a second Apollo with shared memory and reminders.

## Context notes

The per-mode accent color ring, the pitch variants for effects, and the PCM/Opus decode fix all landed on 2026-08-08 — see the firmware and server git logs for that day. Timers, lists, dollar rates, email, and the streaming/speculative TTS path landed on 2026-08-10 (`444f324`); each now has its own chapter in Part III.

## Navigation

Prev: [Mapping](mapping.md)
