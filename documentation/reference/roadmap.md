# Roadmap

Open work only. Status as of 2026-08-12, against worker `main` and firmware 2.7.0.

Shipped items are not tracked here — each one has a chapter in Parts II–III, and the
reasoning behind it is in its pull request. Items are grouped by which side has to change,
because that is what they cost: the worker deploys on every push to `main`, and the
firmware self-updates over OTA (`.github/workflows/publish.yml`, `PROJECT_VER` as the
release trigger), so neither costs a cable flash any more. Spoken examples stay in
Rioplatense Spanish because that is what a user literally says to the device.

## Both sides

### 1. Live captions

Show what the user is saying while they speak, and clear it the moment the turn ends so the
screen goes back to just the face.

- **Server**: transcription is still post-hold — audio buffers in memory and goes to STT as
  one blocking request after `hold_end`/`audio_end` (`src/voice/stt.ts`). Needs streaming
  STT over the chunks already arriving on the WebSocket, plus an incremental caption message.
- **Firmware**: closer than it looks. `application.cc` already has an `stt` handler that
  renders a user caption, but the Apollo protocol never emits that type. Wire the branch,
  and clear explicitly on end of turn — today captions only clear on the transition to Idle
  or on channel close.

### 2. Typed on-screen cards (`ui_card`)

Beyond face + caption: weather with an icon, the dollar rate, the grocery list while it is
being read out, and the document QR for a finished background task. Typed and bounded, no
arbitrary layouts.

The QR is the oldest piece and still unwired on both sides: `background_result` already
carries `documentKey`, but the server never builds a URL or a message, and the protocol
schema has no such type. On the device `emote_set_qrcode_data` exists in the gfx component
and the 1.85C layout even declares a 150 px `qrcode` object, but nothing routes to it.
Needs an auto-close timeout.

The firmware currently discards the dashboard state on purpose ("dashboard has no UI yet",
`apollo_protocol.cc`) while the server keeps pushing clock + weather on tap and refreshing
every 30 minutes; that dashboard comes back in through here.

### 3. `long_press`

The only gesture still missing from the raw-event vocabulary, and no longer just an enum
entry: a long press on the screen is claimed by hold-to-talk. "Hold to start a pomodoro or
a briefing" needs either the physical button's long-press (already detected in `button.cc`,
unused) or a rethink of the touch grammar.

## Firmware only

### 4. Touch reactions on the face

Touching the eyes or other zones triggers an immediate reaction — a blink, surprise,
annoyance if the user keeps at it. Map touch zones to catalog emotes with a small cooldown
and escalation on repeats. Today the only coordinate-aware touch code is the confirm-screen
hit-test (`confirm_geometry.h`); gestures classify by shape only, and a bare tap is consumed
locally as a stop.

## Server only

The firmware already has the vocabulary all of these need — notifications, telemetry, MCP,
confirmations, session flow — so each ships on a push to `main`.

### 5. Owner dashboard: the page

The server half landed 2026-08-12: external MCP servers install at runtime through
`@callable()` RPC, their tools are opt-in one at a time, and connections carry a `device` or
`dashboard` role. See [MCP servers](../capabilities/mcp.md).

What is left is the page. Vite + React using `useAgent` from `agents/react`, served by an
`assets` binding on the worker so one origin covers both the page and the WebSocket. The
`DASHBOARD_SHARED_SECRET` it authenticates with is a deliberate placeholder for Cloudflare
Access, which would replace `resolveApolloConnectionRole` and nothing else.

Beyond the MCP installer, the panels worth having are the ones that explain rather than
configure: which initiative candidates were suppressed and by which rule, what the
owner-memory block currently says, which OTA attempts were made. A control panel for an
autonomous thing is mostly an observability panel with a few overrides. The transcript and
tool-call console — the original "debug without serial" idea — belongs here too.

### 6. Owner routine model

Learn the owner's daily rhythm from data already arriving: interaction timestamps, channel
open/close, telemetry cadence. Aggregate into a profile — when they are at the desk, when
they focus, when they disappear — and let it drive the timing decisions that are hard-coded
today. The initiative engine's quiet hours become learned instead of configured, background
moods get "sleepier at night" grounded in *this* owner's night, and a morning briefing fires
at the hour the owner actually shows up.

### 7. Curiosity loop

Apollo occasionally asks a question of its own — "¿cómo salió la reunión?", "¿en qué andás
hoy?" — to fill gaps in its owner model. The mechanics already exist: session flow keeps the
mic open when a turn ends with a question, and `turn_end { expectsReply }` steers it. What is
missing is the impulse: a policy that, in a lull or at a natural turn boundary, decides a
question is worth the interruption. Strictly budgeted through the initiative engine; answers
feed back into memory.

### 8. Self-scheduled follow-ups

The reminder scheduler is user-only today — every entry comes from an explicit spoken
request. Give the *agent* a tool for its own one-shot follow-ups: "te aviso en una hora si no
llegó la respuesta", checking back on a long-running coding task, re-raising something the
owner deferred. Delivery rides the existing reminder → notification path unchanged; the only
new surface is the tool and a marker separating agent-originated entries so they can be
listed and cancelled apart from the owner's.

### 9. Repo/CI sentinel

The coding engine already resolves the owner's repositories from the GitHub App installations
(`list_coding_repositories`, `src/coding/`). Watch them: poll on a cron or take webhooks into
the worker, and when CI goes red or a review is requested, announce it through the initiative
engine and offer to act — "se rompió el build de apollo, ¿lo miro?". Acceptance flows through
the Sí/No confirmation, which already replays the approval into the next LLM turn. Turns the
coding stack from on-demand into a standing watch.

### 10. Background moods

Idle should not always be neutral: subtle variation by time of day and last interaction.
Today idle is a fixed `"neutral"` blink every 12 s. The transport is already there — `emotion`
rides every `ui_state` — but the mapping is a pure lookup with `idle → neutral`
(`src/persona/face.ts`). Only the policy is missing. Grounding it in item 6 beats a clock.

## Under consideration

No commitment on any of these.

- **Voice barge-in** — interrupting by *talking* over Apollo. Untested; the raw mic path has
  no AEC. Touch barge-in already works, so this is only the hands-free case. The VAD watchdog
  gives session flow an endpointer, but nothing listens during playback.
- **Morning briefing** — weather plus the day's reminders at a fixed hour, on top of the
  existing reminder cron. Item 6 would pick the hour.
- **Night mode** — minimum brightness, quieter effects, silenced notifications in a range.
- **Multi-device** — the protocol already routes by `device_id`; formalize a second Apollo
  with shared memory and reminders. Note that installed MCP servers are per-instance, so
  this needs a decision about what a second device inherits.

## Known warts

Small, known, and not worth their own item:

- A mic reopened by session flow still reports `"wake"` on the wire; the start event does not
  distinguish a continuation from a real wake.
- "Apagá la pantalla" has no tool. Brightness 0 is the closest affordance — the screen and
  theme tools are compiled out on the 1.85C build (`HAVE_LVGL` is undefined under the emote
  engine), and screen sleep exists only as the local 60 s idle timeout.
- The notifier speaks `notification.summary` raw rather than framing it ("terminé \<task\>:
  …"); only the coding workflow builds its own framed summary.
- Hold-to-talk turns fall back to Idle instead of reopening the mic. Intentional, but it
  surprises people.
- The open-mic "pulse" on the ring was never built; the signal is the `listen_anim` face plus
  an audible cue.

## Navigation

Prev: [Mapping](mapping.md)
