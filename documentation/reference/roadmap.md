# Roadmap

Status as of 2026-08-11, verified against worker `main` (`15237ee`) and firmware 2.6.0 (`d8f09d5`); items 1, 6, and 15 landed later the same day on `feat/streaming-and-arc` (firmware 2.7.0). Items under **Confirmed** are already decided; the detail under each one says which side it touches — server, firmware, or both. Spoken examples stay in Rioplatense Spanish because that is what a user literally says to the device.

Since 2026-08-10 the OTA loop is closed end to end: the worker deploys on every push to `main` (`.github/workflows/deploy.yml`), the firmware publishes to R2 on every push to its `main` (`.github/workflows/publish.yml`, with `PROJECT_VER` as the release trigger), and the device self-updates. Firmware changes no longer cost a cable flash — which reshuffles the cost side of every pending item below.

## Confirmed

### 1. Focus mode visible on screen — ✅ implemented 2026-08-11, ships with firmware 2.7.0

`ui_state` now carries the whole window — `focusStartedAt`/`focusEndsAt` in epoch seconds — so the device counts down locally between event-driven pushes instead of chasing a stale `focusRemainingSec` (still sent for older firmware). The firmware draws it as a draining arc over the accent ring: `OverlayAccentRing` paints only the pixels whose clockwise-from-noon angle falls inside the remaining fraction, and a 1 Hz refresh timer keeps the arc moving while the emote engine is otherwise idle. The same arc serves the timer from item 6.

### 2. Complete background result: document QR

- **Spoken notice**: ✅ done. `deliverDeskDeviceNotification` (`src/agents/notify.ts`) synthesizes and paces TTS for both `background_result` and `reminder`, queues them as pending messages when nobody is connected, and stays quiet during focus. What is left is cosmetic: the notifier speaks `notification.summary` raw rather than framing it ("terminé \<task\>: …") — only the coding workflow builds its own framed summary.
- **QR on screen**: pending on both sides. The `background_result` frame already carries `documentKey`, but the server never builds a URL or a QR message, and the protocol schema has no such type. On the device the capability sits unwired: `emote_set_qrcode_data` exists in the gfx component and the 1.85C layout even declares a 150 px `qrcode` object, but nothing routes to it. Needs a new message (say `"type": "qr"`) with an auto-close timeout.

### 3. Device → server telemetry + agent reactions — ✅ shipped 2026-08-10

`{"type":"telemetry", battery, charging, volume, wifiRssi, firmwareVersion, ts}` goes out on channel open, every 60 s, and immediately on a charging edge. The server keeps the snapshot in memory, stamps it into the system prompt while fresh, and announces low battery (≤15%, 30 min cooldown, hysteresis at 25%) piercing focus as `critical`. Since `5091bb1` the snapshot also survives deploys (persisted in `session_prefs`, re-read at turn start) and the persona owns it as first-person state. Battery sensing required wiring `AdcBatteryMonitor` into the 1.85C board — BAT_ADC on GPIO8 through a 200K/100K divider; there is no charge-status GPIO, so charging is the estimation library's voltage-trend guess. See `src/telemetry/logic.ts` and `Application::MaybeSendTelemetry`.

### 4. Semantic `audio_end` — ✅ shipped 2026-08-10

The firmware remembers which mode started the listen (`listen_started_by_hold_` in `apollo_protocol.cc`) and ends it with the matching event: `hold_end` for push-to-talk, `audio_end` for wake-word turns. `listen_cancel` joined in 2.6.0 for turns the VAD gives up on. Known wart: a mic reopened by session flow (item 8) still reports `"wake"` on the wire — the start event doesn't distinguish continuation from a real wake.

### 5. Device-side MCP: the agent with hands on the hardware — ✅ shipped, live since the 2.6.0 OTA

`apollo_protocol.cc` routes `"mcp"` frames into `application.cc` (speaking the Apollo dialect: `{"type":"mcp","payload",…,"ts"}`), and the server bridges agent tools to the embedded MCP over the websocket (`src/mcp/bridge.ts`: integer JSON-RPC ids, 5 s timeout awaited inside the tool handler). Exposed to the LLM as `set_volume`, `set_brightness`, and `device_status` (`src/tools/device.ts`); the device's user-only tools (`self.reboot`, `self.upgrade_firmware`, `self.get_system_info`) stay callable from server code but hidden from the model. "Apagá la pantalla" still has no tool — brightness 0 is the closest affordance; the screen/theme/snapshot tools are compiled out on the 1.85C build (`HAVE_LVGL` is undefined under the emote engine), and screen sleep exists only as the local 60 s idle timeout.

### 6. Voice timer with ring progress — ✅ implemented 2026-08-11, ships with firmware 2.7.0

"Poné 10 minutos" → `set_timer` still rides the reminder scheduler, and now also broadcasts `{"type":"timer", endsAt, durationSeconds}` so the ring drains in the mode's color until the end (the reminder's ding and TTS already cover completion). A timer arc outranks the focus arc while live; cancelling a timer hands the arc to the soonest timer still running, or clears it (`cancel_reminder` detects the `Timer` message prefix). The pomodoro needs no timer message: it activates focus, and the item-1 arc covers it.

### 7. Live captions (cleared when the turn ends)

Show what the user is saying while they speak, using partial streaming STT, and clear the text as soon as the turn ends so the screen goes back to just the face.

- **Server**: transcription is still post-hold — audio buffers in memory and goes to STT as one blocking request after `hold_end`/`audio_end` (`src/voice/stt.ts`). Needs streaming STT over the chunks already arriving on the WebSocket, plus an incremental caption message.
- **Firmware**: closer than it looks — `application.cc` already has an `stt` handler that renders a user caption, but the Apollo protocol never emits that type. Wire the branch, and clear explicitly on end of turn (today captions only clear on the transition to Idle or on channel close).

### 8. Conversation continuity — ✅ shipped in 2.6.0 as "session flow"

After playback drains, the firmware reopens the mic by itself — no wake word, no hold — with a VAD watchdog (700 ms cue grace, 300 ms min speech, 1.2 s endpoint silence, 3 s no-speech timeout → `listen_cancel`). The server steers the loop per turn: the LLM appends `[[escucho]]` (or ends with a question) and `turn_end { expectsReply }` tells the device whether to keep listening (`src/turn/run.ts`, `src/agents/runtime.ts`); announcements never reopen. Closing phrases need no special-casing — the model simply doesn't mark a goodbye turn.

Loose ends, all minor: hold-to-talk turns intentionally fall back to Idle; the reopened mic reports `"wake"` on the wire (see item 4); and the promised ring "pulse" was never built — the open-mic signal is the `listen_anim` face plus an audible cue.

### 9. Touch reactions on the face

Touching the eyes or other zones of the face triggers an immediate reaction — a blink, surprise, annoyance if the user keeps at it. Pure firmware, no server: map touch zones to catalog emotes with a small cooldown and escalation on repeats. Today the only coordinate-aware touch code is the confirm-screen hit-test (`confirm_geometry.h`); gestures classify by shape only, and a bare tap is consumed locally as a stop.

### 10. Background moods

The idle face should not always be neutral: subtle variation by time of day and last interaction (sleepier at night, more awake in the morning, "happy" for a while after a long chat). Today idle is a fixed `"neutral"` blink every 12 s.

- **Firmware**: can be resolved entirely locally (SNTP clock + last turn), or
- **Server**: the transport is already there — `emotion` rides every `ui_state` — but the mapping is a pure lookup with `idle → neutral` (`src/persona/face.ts`). Only the policy is missing, so the agent could influence idle mood with a server-only change.

## Proposed 2026-08-08: more server ↔ firmware interaction

Guiding principle: the firmware only gains **vocabulary** — new protocol events and commands — while the semantics always live in the server. Both sides now deploy automatically (worker on push, firmware over OTA), so the original "fit it in one flash" batching no longer constrains anything.

### 11. Gestures as raw events — ✅ shipped (long_press still open)

The pattern landed: the firmware emits `{"type":"gesture","gesture":"tap"|"double_tap"|"swipe_left"|"swipe_right","ts":…}` with no local semantics, and the server decides what each one means in `#handleGesture` (`src/agents/apollo.ts`) — tap toggles the dashboard, swipes cycle the speech mode, double_tap is a deliberate no-op server-side (the mute is local). Remapping is a worker deploy.

Touch barge-in shipped alongside it, through a dedicated `abort` message: a tap while Apollo is speaking stops the stream within a chunk and the server answers `tts_aborted`.

Still open: `long_press` — and it is no longer just an enum entry, because a long press on the screen is claimed by hold-to-talk. "Hold to start a pomodoro or a briefing" needs either the physical button's long-press (already detected in `button.cc`, unused) or a rethink of the touch grammar.

### 12. Server-triggered earcons (`play_effect`) — ✅ shipped 2026-08-10

`{"type":"play_effect", "name":"ding"|"chime"|"error"|"low_battery"}` plays effects already burned into flash. The names are logical — the firmware maps them to assets (`ding`→success, `chime`→popup, `error`→exclamation) so the server can re-purpose sounds without touching firmware. Wired at reminder/timer delivery, confirm requests, turn failures, and the low-battery announcement from item 3.

### 13. `set_volume` from the server — ✅ shipped 2026-08-10 via item 5

Came for free through the MCP bridge, as predicted: `set_volume` is one of the three tools item 5 exposes to the agent.

### 14. OTA from R2 — ✅ shipped end to end; push-style updates still open

The full loop is live: the worker serves `/ota/check` and `/ota/firmware.bin` from the `MEDIA` bucket (`src/ota/`, token-authenticated, versions strictly `digits.and.dots`), every push to the firmware `main` builds and publishes to R2 (`publish.yml`, `PROJECT_VER` bump as the trigger), and the device checks off the boot path and self-updates through `esp_ota` with rollback protection. The 2.6.0 fleet arrived this way — cable flashing is over. Publishing steps live in [Deploy](../operations/deploy.md#publishing-firmware-ota).

Still open: **push-style updates**. Telemetry reports `firmwareVersion`, but the server never compares it against the R2 manifest nor calls `self.upgrade_firmware` over the item-5 bridge — a device that never reboots never updates.

### 15. `tts_end` + playback acks — ✅ implemented 2026-08-11, ships with firmware 2.7.0

- **`tts_end`**: `tts_start.bytes` is now optional vocabulary — a run without a total stays open until the `tts_end` terminator, so audio can be sent mid-synthesis. The server still sends `bytes` (its synthesis is per-sentence and whole-buffer today), which keeps 2.6.0 devices working; piping the ElevenLabs response body through as it arrives is the follow-up the protocol no longer blocks.
- **Acks**: the device reports `{"type":"playback_ack", sequence, playedMilliseconds}` once a second while speaking — played time counted at the codec output in source-stream time, `sequence` echoed from `tts_start` so a stale run's acks are discarded. `streamAudioChunksAtPlaybackPace` uses them as a closed loop (measured backlog held at the 4 s ceiling, extrapolated between acks) and falls back to the open-loop 0.85 pace when no ack arrives. Announcements (`notify.ts`) stay open-loop on purpose: a broadcast has no single device whose acks could steer it.

### 16. Typed on-screen cards (`ui_card`)

Beyond face + caption: a circular timer countdown (which merges with item 6), weather with an icon, the dollar rate, the grocery list while it is being read out. Typed and bounded — timer, weather, list, rate, QR (the QR is already in item 2) — with no arbitrary layouts. The firmware still discards the dashboard state on purpose ("dashboard has no UI yet", `apollo_protocol.cc`), while the server keeps pushing clock + weather on tap and refreshing it every 30 minutes; that dashboard would come back in through here.

## Proposed 2026-08-11: independence and proactivity

Guiding principle: Apollo grows with its owner — it originates actions instead of only reacting, and it accumulates a model of the person it lives with. Every item in this section is **server-only**: the firmware already has all the vocabulary these need (notifications, telemetry, MCP, confirmations, session flow), so each one deploys on a push to `main`.

### 17. Initiative engine

The substrate for everything below: a server-side policy that lets Apollo decide to speak unprompted. The delivery half already exists — `deliverDeskDeviceNotification` (`src/agents/notify.ts`) paces TTS, queues pending messages when nobody is connected, and stays quiet during focus. What is missing is origination: nothing in the worker ever *decides* Apollo has something worth saying. Needs a policy layer with hard bounds so it never becomes annoying — quiet hours, focus awareness (already respected downstream), and a daily budget of self-initiated utterances. Items 20–23 all deliver through this.

### 18. Long-term owner memory

A persistent store of facts and preferences about the owner, consolidated by a nightly job on the existing reminder cron and stamped into the system prompt while relevant — the same pattern telemetry established (snapshot in `session_prefs`, re-read at turn start, owned first-person by the persona). Extraction runs over recent transcripts; consolidation merges, decays, and drops stale facts. "¿Qué aprendiste de mí?" should get a real answer.

### 19. Owner routine model

Learn the owner's daily rhythm from data already arriving: interaction timestamps, channel open/close, telemetry cadence. Aggregate into a profile — when they are at the desk, when they focus, when they disappear — and let it drive timing decisions that are hard-coded or missing today: the initiative engine's quiet hours become learned instead of configured, background moods (item 10) get "sleepier at night" grounded in *this* owner's night, and a future morning briefing fires at the hour the owner actually shows up.

### 20. Curiosity loop

Apollo occasionally asks a question of its own — "¿cómo salió la reunión?", "¿en qué andás hoy?" — to fill gaps in its owner model (item 18). The mechanics are already built: session flow (item 8) keeps the mic open when a turn ends with a question, and `turn_end { expectsReply }` steers it. What is missing is the impulse: a policy that, in a conversational lull or at a natural turn boundary, decides a question is worth the interruption. Strictly budgeted through the initiative engine; answers feed back into the memory store.

### 21. Self-scheduled follow-ups

The reminder scheduler is user-only today — every entry comes from an explicit spoken request. Give the *agent* a tool to create its own one-shot follow-ups: "te aviso en una hora si no llegó la respuesta", checking back on a long-running coding task, re-raising something the owner deferred. Delivery rides the existing reminder → notification path unchanged; the only new surface is the tool and a marker distinguishing agent-originated entries so they can be listed and cancelled separately.

### 22. Repo/CI sentinel

The coding engine already resolves the owner's repositories from the GitHub App installations (`list_coding_repositories`, `src/coding/`). Watch them: poll on a cron (or take webhooks into the worker), and when CI goes red or a review is requested, announce it through the initiative engine and offer to act — "se rompió el build de apollo, ¿lo miro?". Acceptance flows through the full-screen Sí/No confirmation, which already replays the approval into the next LLM turn, and launches the opencode engine (item under "Shipped": coding on opencode). Turns the coding stack from on-demand into a standing watch.

### 23. Self-maintaining device

Close the open half of item 14 and give it personality. The server compares telemetry's `firmwareVersion` against the R2 manifest and, when the device is idle and preferably charging, calls `self.upgrade_firmware` over the item-5 MCP bridge — no more devices stranded on old firmware because they never reboot. Then the payoff: `publish.yml` stores a short changelog next to the manifest at build time, and when the post-reboot telemetry reports the new version, Apollo tells the owner what changed — "me actualicé anoche: ahora la cuenta regresiva se ve en el aro". Self-maintenance becomes a visible part of the relationship instead of silent plumbing.

## Under consideration (ideas, no commitment)

- **Voice barge-in**: interrupting the assistant by *talking* over it. Untested; the raw mic path has no AEC (see the wake word notes). Touch barge-in already works (item 11), so this is only about the hands-free case. The 2.6.0 VAD watchdog gives session flow an endpointer, but nothing listens during playback.
- **Morning briefing**: weather plus the day's reminders by voice at a fixed hour, orchestrated on top of the existing reminder cron.
- **Night mode**: minimum brightness, quieter effects, and silenced notifications within an hour range — a natural fit on top of MCP + telemetry.
- **Web session console**: a page served by the worker with transcripts, tool calls, and errors, for debugging without serial.
- **Multi-device**: the protocol already routes by `device_id`; formalize a second Apollo with shared memory and reminders.

## Shipped since the last revision (2026-08-10 → 2026-08-11)

Beyond the items above, landed and not previously tracked here:

- **microWakeWord "Hey, Apólo"**: TFLite streaming model on the AFE output replaced WakeNet (`main/audio/wake_words/micro_wake_word.cc`), model swappable via `-DMICRO_WAKE_WORD_MODEL`. Part of the 2.6.0 perf pass (`-O2`, bigger data cache, OTA check off the boot path), plus a 10 s idle channel pre-warm so press-and-hold finds an open socket.
- **Full-screen Sí/No confirmations**: dedicated confirm screen with touch hit-testing (`confirm_geometry.h`), single-winner arbitration between button, local expiry (clamped 3–45 s), and the new `confirm_close` message the server broadcasts on resolve/expire/orphan. Approved confirmations are also replayed into the next LLM turn so the model knows what it asked for (`9e9b345`).
- **Coding engine on opencode**: coding tasks run opencode behind a worker-hosted LLM proxy (`src/coding/opencode.ts`, `src/coding/proxy.ts`; HMAC-tokened `/coding-llm/v1`, 45 min cap), env-gated with the legacy loop as fallback. Repos are resolved from *spoken* names against the GitHub App installations (`list_coding_repositories`, `resolveSpokenRepositoryReference`) — the agent never asks for a URL.

## Context notes

The per-mode accent color ring, the pitch variants for effects, and the PCM/Opus decode fix all landed on 2026-08-08. Timers, lists, dollar rates, email, and the streaming/speculative TTS path landed on 2026-08-10 (`444f324`); each has its own chapter in Part III. Telemetry, earcons, semantic `audio_end`, MCP bridge, and OTA landed 2026-08-10; microWakeWord, session flow, full-screen confirmations, and the publish pipeline landed with firmware 2.6.0 on 2026-08-11.

## Navigation

Prev: [Mapping](mapping.md)
