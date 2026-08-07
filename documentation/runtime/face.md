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

There is no amplitude or viseme channel on the wire. TTS audio ships to the device as a single buffer (`tts_start` + binary payload — see [Voice](voice.md)); firmware should derive any mouth/talk animation from the decoded audio it's already playing, not from a server-computed signal.

## Firmware recommendation (not part of this repo)

Rendering is a device-side concern; no firmware lives in this repository. For the two-eyes-blinking look, [FluxGarage RoboEyes](https://github.com/FluxGarage/RoboEyes) (MIT) draws eyes procedurally — no image assets, built-in blink/saccade timing, and an emotion set that maps cleanly onto the table above. [M5Stack-Avatar](https://github.com/meganetaaan/m5stack-avatar) is a heavier alternative that adds a breathing/talking mouth driven by audio amplitude, if a face-only look ever needs more life.

## Navigation

Prev: [Persona](persona.md) · Next: [Tools](../capabilities/tools.md)
