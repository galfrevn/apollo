# Timers

Timers are countdowns you set by voice: "poné diez minutos". They are deliberately not a
separate scheduler — a timer is a short reminder whose message announces itself, so it
inherits delivery, focus gating, and cancellation from [Reminders](reminders.md).

## Tools

- `set_timer` — `durationSeconds` (5 s to 24 h) plus an optional `label`
- `start_pomodoro` — `minutes` (5 to 120, default 25); also activates focus

`cancel_reminder` cancels timers too, because they are reminder rows underneath.

## Behavior

`set_timer` schedules a reminder whose message is either "Timer de ⟨duración⟩ terminado."
or "Timer terminado: ⟨label⟩." Durations are spoken back through
`formatDurationForSpeech` (`apps/agent/src/tools/timer.ts`), which rounds to seconds, minutes, or
"⟨n⟩ horas y ⟨m⟩ minutos" so the confirmation sounds natural rather than numeric.

`start_pomodoro` does two things in one call: it applies focus for the requested minutes
(so the desk quiets down — see [Focus](focus.md)) and schedules the "Pomodoro terminado.
Tomate un descanso." announcement.

## Device surface

The server currently sends no timer-specific message: the device learns a timer exists
only from the spoken confirmation, and learns it finished from the `reminder` message.
Carrying duration/remaining on the wire so the device can draw a countdown arc is
[Roadmap](../reference/roadmap.md) item 6.

## Code

`apps/agent/src/tools/timer.ts`, riding the scheduler in `apps/agent/src/reminders/logic.ts`.

## Navigation

Prev: [Reminders](reminders.md) · Next: [Broadcast](broadcast.md)
