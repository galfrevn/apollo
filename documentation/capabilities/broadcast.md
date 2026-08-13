# Broadcast

Broadcast lets the owner speak through the desk from the console: type a phrase and Apollo reads it aloud in its own voice, or record audio and the device plays the owner's actual voice. It exists for leaving messages to whoever is near the desk when the owner is not — "vuelvo a las ocho" sounding in the room, not a notification on a phone.

## Delivery

Both modes are owner-triggered, so they bypass every proactive-speech policy on purpose: no quiet hours, no daily budget, no focus deferral, no initiative engine. The device plays a `chime` earcon, then the standard speech run (`tts_start` → PCM frames → `tts_end` → `turn_end { expectsReply: false }`). A text broadcast also sends a `reminder` card so the screen shows the message; an audio broadcast is sound only. Nothing here required a firmware change — the wire vocabulary is entirely reused.

Text goes through the normal TTS pipeline (sanitize, ElevenLabs, R2 cache). Recorded audio never touches ElevenLabs: the browser produces the exact wire format — raw s16le mono PCM at 24 kHz — by capturing through an `AudioWorklet` and resampling with an `OfflineAudioContext`, because the Worker has no audio decoder and the ESP32 cannot decode anything else.

## Upload

The console cannot push binary frames over its WebSocket (non-device connections are excluded from raw message handling by design), so recorded audio rides the RPC surface as base64 chunks: `beginConsoleBroadcastAudioUpload` → up to 8 × `appendConsoleBroadcastAudioChunk` (180,000 raw bytes each) → `commitConsoleBroadcastAudioUpload`. Recordings cap at 30 seconds (1,440,000 bytes), which keeps every chunk far under the WebSocket frame limit. Upload sessions live in Durable Object memory with a 2-minute TTL; a DO restart mid-upload fails the commit with a clear error and the console restarts from the first chunk.

## Offline queueing

A broadcast sent while the device is offline is not lost: text is stored as a pending row (and re-synthesized on delivery — the TTS cache makes this free), audio is stored in R2 under `broadcast-audio/<id>.pcm` with a pending row pointing at it. On the next device connect the pending flush replays broadcasts *with sound* — chime plus the full speech run — unlike reminders and background results, which replay as silent cards. Queued broadcasts expire after 24 hours; the flush sweeps expired rows and their R2 objects before replaying.

## Where the code lives

`apps/agent/src/broadcast/` holds the pure upload/session logic (`logic.ts`) and the delivery orchestration (`deliver.ts`); the `@callable` wrappers sit in `apps/agent/src/agents/apollo.ts`. The console page is `apps/console/src/broadcast/` — recorder, upload client, and the panel UI.

## Navigation

Prev: [Timers](timers.md) · Next: [Lists](lists.md)
