# Persona

Apollo’s voice is shaped by a soul prompt plus a selectable speech mode.

## Soul

`apps/agent/src/persona/soul.ts` builds the system prompt: identity, operating rules (which tools to prefer), and the active mode override. The spoken identity is Rioplatense Spanish in product behavior, even though this handbook is written in English for developers.

## Speech modes

Modes are catalogued in `apps/agent/src/persona/catalog.ts`:

| Id | Intent |
|----|--------|
| `default` | Clear and useful, short spoken answers |
| `nerd` | Precise / technical |
| `playful` | Playful Argentine tone, never mean |
| `warm` | Warmer check-ins, still practical |

Gestures on the device can cycle modes; the current mode is echoed in every `ui_state`.

## Why it matters on ESP32

Speech mode is a first-class desk control, not a settings-page afterthought. The user should feel the change immediately in the next reply. Each mode's `accentColor` also drives the on-device face — see [Face](face.md).

## Navigation

Prev: [Voice](voice.md) · Next: [Face](face.md)
