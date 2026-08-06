# Protocol

Device and server speak a Zod-validated JSON protocol defined in `src/protocol/schema.ts`. Binary audio rides alongside; control messages stay structured and small for the ESP32.

## Device → server

| Type | Role |
|------|------|
| `hello` | Identify the device after connect |
| `hold_start` / `hold_end` | Push-to-talk boundaries |
| `wake` | Wake without a full hold gesture |
| `audio_end` | End of an utterance |
| `gesture` | `tap`, `double_tap`, `swipe_left`, `swipe_right` |
| `confirm` | Accept or reject a pending confirmation |
| `text_input` | Typed fallback input |

## Server → device

| Type | Role |
|------|------|
| `ui_state` | Mode, speech mode, caption, focus remaining |
| `confirm_request` | Ask the user to approve a tool side effect |
| `tts_start` | Announce upcoming speech audio |
| `error` | Structured failure |
| `dashboard` | Clock + weather snapshot |
| `background_result` | Completed async work summary |
| `reminder` | Reminder delivery |

## Design notes

- Discriminated unions keep parsing strict on both sides
- Optional fields stay optional — the device should tolerate missing captions or focus seconds
- Firmware details beyond this wire contract are out of scope for this handbook

## Navigation

Prev: [Loop](loop.md) · Next: [Voice](voice.md)
