# Reminders

Reminders schedule future spoken/device messages without keeping the WebSocket conversation busy.

## Tools

- `set_reminder`
- `list_reminders`
- `cancel_reminder`

## Delivery

When a reminder fires, the server sends a `reminder` protocol message (and may use pending-device delivery if the client was briefly disconnected). Scheduling helpers live in `src/reminders/logic.ts` with tool wrappers in `src/tools/reminder.ts`.

## Navigation

Prev: [Focus](focus.md) · Next: [Timers](timers.md)
