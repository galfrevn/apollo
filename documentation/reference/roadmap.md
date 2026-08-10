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

### 3. Device → server telemetry + agent reactions

The protocol has no device → server status message at all. The board already measures battery (`adc_battery_estimation`, and a local `low_battery.ogg` exists).

- **Firmware**: a periodic `{"type":"telemetry", battery, charging, volume, ...}` message, plus an immediate push on sharp changes, along with WiFi signal and firmware version. (Mute state is no longer part of this: the silent double-tap mute that caused the original bug was removed on both sides — with push-to-talk the mic is only open while a finger is down, so there is nothing to mute.)
- **Server**: keep the latest snapshot in agent state; expose it to the agent in the turn's system prompt; proactive reactions ("estás con 15% de batería, enchufame") over the notification channel.
- **Schema**: add the message to `deviceToServerMessageSchema` in `src/protocol/schema.ts`.

### 4. Semantic `audio_end`

The schema already distinguishes `hold_end` (finger released) from `audio_end` (VAD-detected end after a wake word), but the firmware always sends `hold_end` (`SendStopListening` in `apollo_protocol.cc`). Small change: remember which mode started the listen and send the matching event. It gives the server the signal it needs to adapt behavior, such as using different timeouts.

### 5. Device-side MCP: the agent with hands on the hardware

The most powerful piece. `application.cc` already has an `McpServer` (inherited from xiaozhi) with volume, brightness, and other tools, but:

- `apollo_protocol.cc` never routes `"mcp"` messages — the branch exists in `application.cc` and is dead.
- On the server side, the agents SDK's `cf_agent_mcp_servers` traffic is ignored on purpose.

Connecting both ends would let the agent act by voice: "bajá el brillo", "subí el volumen", "apagá la pantalla", "poné cara de contento". Requires defining the bridge between the agents SDK tool format and the embedded MCP.

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

### 12. Server-triggered earcons (`play_effect`)

A `{"type":"play_effect", "name":"ding"|...}` message that plays effects already burned into flash — the ogg/opus pipeline with pitch variants already exists. Instant, free feedback: the timer sounds immediately while the announcement's TTS is still being synthesized, a confirmation chime, an error tone without spending ElevenLabs credits.

### 13. `set_volume` from the server

A trivial command for "bajá el volumen" by voice. It overlaps with device-side MCP (item 5, which already exposes volume and brightness): if item 5 lands soon this comes for free through it; if not, a simple message works as a bridge.

### 14. OTA from R2

The server hosts the firmware binary in the `MEDIA` bucket, the device checks its version at boot (HTTP + `esp_ota`) and updates itself. Given how risky cable flashing is on this board — never touch DTR/RTS — it pays for itself: one last manual flash, and from then on the firmware "deploys" too. Promoted from "Under consideration", where it was listed as "OTA over WiFi".

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
