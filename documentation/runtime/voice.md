# Voice

Apollo is voice-first. Replies are written to be spoken: short, natural sentences rather than long markdown essays.

## Pipeline

1. **STT** — device audio is transcribed (OpenRouter Whisper Large V3 by default)
2. **Reasoning** — the model sees soul + mode prompts, session context, and tool results
3. **TTS** — the reply is synthesized (Kokoro voice `af_alloy` by default) and streamed to the device

Configuration knobs live in `wrangler.jsonc` vars such as `OPENROUTER_STT_MODEL`, `OPENROUTER_MODEL`, and `OPENROUTER_TTS_MODEL`. Implementation details sit under `src/voice/`.

## Captions

The server can attach a caption to `ui_state` so the ESP32 can show what is being said even when audio is hard to hear.

## Latency mindset

The loop favors quick spoken answers. Deep research and heavy sandbox jobs should leave the interactive path and return later instead of blocking the desk in `thinking` indefinitely.

## Navigation

Prev: [Protocol](protocol.md) · Next: [Persona](persona.md)
