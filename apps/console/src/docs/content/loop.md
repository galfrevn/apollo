A turn begins when the device detects the wake word and opens a stream to the worker. Everything that follows — transcription, the agent loop, and the spoken reply — happens inside a single session, so the desk keeps context across consecutive turns.

> The handbook is meant to be read in order. Later chapters assume the concepts introduced earlier.

## The turn

The happy path, end to end:

1. The device connects with its token, sends `hello`, and receives the current `ui_state`.
2. You wake it or hold to talk; audio frames stream to the worker while it listens.
3. `audio_end` (or `hold_end`, or a typed `text_input`) closes the capture and the turn runs.
4. The server walks `ui_state` through `listening` → `thinking` → `speaking` so the face always matches what is happening.
5. Speech comes back — announced by `tts_start`, streamed as raw audio, closed by `turn_end`.
6. The desk returns to `idle`, `focus`, or `dashboard`.

When a tool needs approval, the turn pauses between steps 4 and 5: the server sends `confirm_request`, the device shows the summary with Sí/No buttons, and the side effect waits for your `confirm` — or expires after 30 seconds.

## What the device sends

Capture has two shapes that end the same way. Hold-to-talk brackets the audio with `hold_start` and `hold_end`; a wake-word turn starts with `wake` and ends with `audio_end` when the voice-activity detector decides you finished. Either way the microphone audio itself travels as binary frames — 16 kHz mono 16-bit PCM, no envelope.

A turn needs at least 8000 bytes of audio, a quarter second. Anything shorter earns "no llegué a escucharte" instead of a round trip to the transcriber. Around the capture, the device also sends `gesture` events (whose meaning lives on the server — a tap toggles the dashboard, swipes cycle the speech mode), a `telemetry` snapshot every 60 seconds (battery, charging, volume, signal, firmware version), and `abort` when you interrupt Apollo mid-sentence.

## The agent loop

The server transcribes the audio (Whisper Large V3 through OpenRouter), then hands the text to the model along with the persona prompt, the session context, recalled memories, the wall-clock time, and the latest telemetry while it is fresh. The model answers directly or requests tools; `safe` tools run immediately, `unsafe` ones route through the confirmation above. A turn runs at most three tool rounds before it must answer with what it has — the desk never disappears into `thinking` indefinitely. Work that cannot fit that budget, like deep research, leaves the turn and returns later as a `background_result`.

## Speaking back

The reply is synthesized by ElevenLabs and streamed to the device as raw 24 kHz mono PCM, so the ESP32 needs no decoder. Before synthesis, `sanitizeTextForSpeech` strips any markdown the model produced — nothing ever reads "asterisco asterisco" out loud.

Long replies are spoken in sentence-sized segments: the turn only waits for the first one, and each following segment is synthesized while the previous plays. The model even streams its reply as it writes, so the first sentence can be speculatively synthesized before the reasoning finishes. Every production synthesis passes through an R2-backed cache keyed by voice, model, and text — repeated utterances cost zero credits. If you interrupt, the device's `abort` stops the stream within one chunk and the server answers `tts_aborted`; the rest of the reply is never synthesized. Finally `turn_end` says whether Apollo expects a reply — if it asked you something, the device reopens the microphone after playback instead of going back to sleep.
