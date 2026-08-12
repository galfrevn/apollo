# Focus

Focus mode turns the desk into a timer-first companion: fewer announcements, shorter replies, and a visible countdown.

## Tools

- `set_focus` — start a focus interval
- `clear_focus` — end it early

## Device surface

While focus is active, `ui_state` can include `focusRemainingSec`. Gestures and the UI state `focus` keep the ESP32 aligned with the Durable Object timer logic in `apps/agent/src/focus/logic.ts`.

## Behavior contract

Soul instructions tell the model to stay briefer and announce less during focus so the desk does not chatter over deep work.

## Navigation

Prev: [Weather](weather.md) · Next: [Reminders](reminders.md)
