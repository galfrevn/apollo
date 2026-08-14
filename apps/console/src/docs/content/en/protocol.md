The device and the worker speak a small protocol over WebSocket. It is the contract between the firmware and the brain, and the only interface both repositories agree on. This chapter is the full wire contract — enough to build a body of your own without reading the reference firmware.

![Frames traveling in both directions between a small device and a server](/handbook/protocol.jpg)

## Connection lifecycle

A body connects to the agent with its shared secret in the query string:

```
wss://<worker-host>/agents/apollo/<instance-name>?token=<DEVICE_SHARED_SECRET>
```

The instance name is the desk's identity, `desk` by convention. The token is checked with a timing-safe compare **before** the WebSocket upgrade: a bad or missing token gets a plain `401 Unauthorized`, never a half-open socket.

A browser presenting the `DASHBOARD_SHARED_SECRET` instead is tagged as a dashboard connection. It may manage the agent over RPC, but it is never sent audio and its messages never reach the device path. The two secrets are deliberately separate — the device credential is compiled into firmware, so rotating it is a fleet operation, while the dashboard credential lives in a tab and rotates freely.

Once connected, the device sends `hello` with its `deviceId` and receives the current `ui_state`. Two rules keep clients honest in both directions:

- **Device to server is strict.** Every message is validated against a Zod schema; unknown types or malformed fields earn `{ "type": "error", "code": "invalid_message" }`. Every device message carries a `ts` timestamp.
- **Server to device is tolerant.** The client must ignore message types it does not recognize and treat every optional field — caption, emotion, accent color, focus seconds — as genuinely optional. The server may grow the vocabulary at any time without breaking old bodies.

There is also an unauthenticated `GET /health` that answers `{ "ok": true, "name": "apollo", "features": [...] }`. The features array proves which bindings resolved, which makes it the first stop when debugging a deployment.

## Message catalog

Device to server:

| Type | Role |
| --- | --- |
| `hello` | Identify the device after connect |
| `hold_start` / `hold_end` | Push-to-talk boundaries |
| `wake` | Wake without a hold gesture |
| `audio_end` | End of a wake-word utterance, detected by VAD |
| `listen_cancel` | The user cancelled an open listen; discard the audio, no turn runs |
| `gesture` | `tap`, `double_tap`, `swipe_left`, `swipe_right` |
| `confirm` | Accept or reject a pending confirmation |
| `text_input` | Typed fallback input |
| `abort` | Stop the speech currently streaming (barge-in) |
| `telemetry` | Battery, charging, volume, WiFi signal, firmware version |
| `playback_ack` | Progress report for a played clip: its sequence number and milliseconds played |
| `mcp` | JSON-RPC reply from the device's embedded MCP server |

Server to device:

| Type | Role |
| --- | --- |
| `ui_state` | Mode, speech mode, caption, focus remaining, face emotion, accent color |
| `confirm_request` | Ask the user to approve a tool side effect |
| `confirm_close` | The confirmation window ended, drop the confirm screen |
| `tts_start` | Announce the next speech clip — one per segment, not one per reply |
| `tts_end` | The current speech segment is complete; a reply may contain more segments and ends only at `turn_end` |
| `tts_aborted` | The announced clip was cut short and will never complete |
| `timer` | Show the countdown arc with `endsAt` and `durationSeconds`; omitting both fields clears it |
| `turn_end` | Speech fully sent; `expectsReply` says whether to reopen the mic |
| `error` | Structured failure |
| `dashboard` | Clock and weather snapshot |
| `background_result` | Completed async work summary |
| `reminder` | Reminder delivery |
| `play_effect` | Play a sound effect burned into device flash |
| `mcp` | JSON-RPC request for the device's embedded MCP server |

Four entries deserve a word:

- **`gesture`** — meaning lives on the server, not the device. The firmware reports what happened and the brain decides what it means, so behavior changes without a flash.
- **`play_effect`** — carries a logical name (`ding`, `chime`, `error`, `low_battery`) that the firmware maps to flash assets. The earcon plays instantly while TTS is still synthesizing, and unknown names are ignored.
- **`mcp`** — bridges the agent's tools to the hardware itself. The server sends JSON-RPC calls like `self.audio_speaker.set_volume` over the socket, the firmware routes them into its embedded MCP server, and the reply rides back. Correlation is by integer JSON-RPC id, with a five-second timeout that degrades to a spoken "no respondió".
- **`tts_aborted`** — exists because the device counts received bytes against the total announced in `tts_start`. After a barge-in that total never arrives, and without the abort message the device would wait forever for cancelled speech.

> A minimal body does not need all of this. A screenless speaker holds a full conversation with `hello`, a capture pair (`wake` + `audio_end`, or the hold pair), binary audio, `tts_start`, `tts_end`, `tts_aborted`, and `turn_end`. Everything else layers on capability the hardware actually has.

## Audio framing

The framing rule is absolute in both directions: **JSON text frames are control, binary frames are audio.** No envelope, no interleaved metadata.

**Uplink.** Microphone audio streams as 16 kHz mono 16-bit little-endian PCM while a listen session is open, and the session closes with the event matching how it started.

**Downlink.** Each `tts_start` announces a clip with its `format` (`pcm` in production), a byte total when known, an optional sequence number, and 24 kHz mono sample parameters. The binary frames that follow belong to that clip, and `tts_end` closes it. Each spoken segment is its own `tts_start`/`tts_end` pair; only `turn_end` says the reply is over.

## OTA endpoints

Firmware updates ride the same trust model as the socket — two HTTP routes authenticated by the same `?token=` secret, serving from the worker's R2 bucket:

- `GET|POST /ota/check` answers `{ "firmware": { "version", "url", "force" } }`, or `{}` when nothing is published. Versions must match `^\d+(\.\d+)*$`; the device's parser aborts on anything fancier.
- `GET /ota/firmware.bin` streams the binary named by the published manifest, with an explicit `Content-Length`, because the device refuses length-less downloads.

The device checks once at boot, right after time sync, and a failed check just logs and boots normally. The brain can also push an upgrade over the MCP bridge when telemetry shows a device idle, powered, and behind. Publishing steps live in [Firmware](/docs/firmware).
