# Face

Apollo's desk hardware (Waveshare ESP32-S3-Touch-LCD-1.85C-BOX) has a round 360×360 touch LCD. The server doesn't render pixels — it tells the device what to feel, and the device draws it.

## Design principle

The server owns meaning; the device owns rendering. `src/persona/face.ts` maps the UI state machine (`src/session/machine.ts`) to a small emotion vocabulary, and every `ui_state` message carries that emotion plus the active speech mode's accent color. Firmware should not keep its own state→expression lookup table — it reads `emotion` and `accentColor` straight off the wire.

Blinking and saccades stay autonomous on-device. The server never sends blink events; it only signals mood.

## Wire fields

`ui_state` (see [Protocol](protocol.md)) carries:

| Field | Source | Purpose |
|-------|--------|---------|
| `emotion` | `resolveDeskFaceEmotion(uiState)` in `src/persona/face.ts` | Which expression to render |
| `accentColor` | Active speech mode's `accentColor` in `src/persona/catalog.ts` | Eye/UI tint, so personality is visible, not just audible |

## Emotion mapping

| UI state | Emotion |
|----------|---------|
| `idle` | `neutral` |
| `listening` | `curious` |
| `thinking` | `focused` |
| `confirm` | `questioning` |
| `speaking` | `talking` |
| `focus` | `calm` |
| `dashboard` | `neutral` |

## Talking / mouth sync

There is no amplitude or viseme channel on the wire. A reply ships as a *sequence* of
clips — one `tts_start` plus its binary payload per speech segment (see
[Voice](voice.md)) — so the device cannot treat `tts_start` as "the reply begins" either.
Firmware should derive any mouth/talk animation from the audio it is already playing, not
from a server-computed signal.

## Where rendering lives

Rendering is a device-side concern, implemented in the firmware repo
(`firmware/apollo-firmware`, a git submodule of this one), which has its own handbook and
its own emote engine. This chapter defines only what the server promises to send. The
division to preserve: the server may add emotions to the vocabulary, the firmware decides
what they look like.

## Navigation

Prev: [Persona](persona.md) · Next: [Tools](../capabilities/tools.md)
