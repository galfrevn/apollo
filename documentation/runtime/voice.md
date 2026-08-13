# Voice

Apollo is voice-first. Replies are written to be spoken: short, natural sentences rather than long markdown essays. Anything headed for TTS also passes through `sanitizeTextForSpeech` (`apps/agent/src/voice/sanitize.ts`) so stray markdown never gets read out loud ("asterisco asterisco…").

## Pipeline

1. **STT** — device audio is transcribed (OpenRouter Whisper Large V3 by default)
2. **Reasoning** — the model sees soul + mode prompts, session context, and tool results
3. **TTS** — the reply is synthesized by ElevenLabs and streamed to the device as raw 24 kHz s16le mono PCM (`output_format=pcm_24000`, no decoder on the ESP32)

Long replies are spoken in sentence-sized segments (`apps/agent/src/voice/segment.ts`, ≤280 chars each): the turn only waits for the first segment, and each following segment is synthesized while the previous one plays. The paced stream (`apps/agent/src/voice/stream.ts`) additionally caps the device backlog at 4 s — the firmware queues ~6.8 s of frames and silently drops overflow, which used to clip the tail of replies longer than ~30 s.

Two more latency/cost layers sit on that path:

- **LLM streaming + speculative TTS** — the reasoning call streams over SSE (`onTextDelta` in `apps/agent/src/voice/llm.ts`); as soon as the first sentence segment closes, `apps/agent/src/turn/run.ts` starts synthesizing it while the model is still writing. If the round turns out to be a tool call, the speculation is discarded; it is only reused when its text is byte-identical to the final first segment.
- **TTS cache** — every production synthesis goes through `apps/agent/src/voice/synthesize.ts`, which wraps ElevenLabs in the cache from `apps/agent/src/voice/ttscache.ts`: R2 objects under `tts-cache/` keyed by SHA-256 of voice+model+text. Repeated utterances (acks, daily reminders) cost zero ElevenLabs credits. Cache failures degrade to direct synthesis; entries never expire (change voice/model → new keys, old ones become garbage that can be bulk-deleted by prefix).

Configuration knobs:

- `ELEVENLABS_API_KEY` — secret (`.dev.vars` locally, `bunx wrangler secret put ELEVENLABS_API_KEY` in prod)
- `ELEVENLABS_TTS_MODEL` — `apps/agent/wrangler.jsonc` var, default `eleven_multilingual_v2` (best accent fidelity; `eleven_flash_v2_5` is half the credits if quota bites)
- `APOLLO_TTS_VOICE` — voice id constant in `apps/agent/src/configuration/identity.ts` (the owner seam). The model takes no `language_code`, so the Rioplatense accent lives in the voice: pick one from the ElevenLabs Voice Library (Spanish / Argentina), add it to My Voices, paste the id
- STT/LLM stay on OpenRouter: `OPENROUTER_STT_MODEL`, `OPENROUTER_MODEL`

Quota math (Starter ≈ 30k credits/mo): `eleven_multilingual_v2` burns ~1 credit per character, `eleven_flash_v2_5` ~0.5. A typical spoken reply (~200 chars) is ~200 credits.

Implementation details sit under `apps/agent/src/voice/`.

## Interruption

Speech is cancellable mid-reply. The device sends `abort`; the agent sets a flag that the
paced loop checks between chunks (`shouldStop` in `apps/agent/src/voice/stream.ts`), so sending stops
within one chunk instead of at the end of the clip. The server then sends `tts_aborted`,
because `tts_start` promised a byte count the device is counting against — without it the
device waits forever for audio that was cancelled.

Two consequences worth knowing: an abort ends the *whole* reply, not just the current
segment (remaining segments are never synthesized, which also saves the credits), and a
new turn always clears the flag, so an abort can never leak into the next reply.

## Captions

The server can attach a caption to `ui_state` so the ESP32 can show what is being said even when audio is hard to hear.

## Latency mindset

The loop favors quick spoken answers. Deep research and heavy sandbox jobs should leave the interactive path and return later instead of blocking the desk in `thinking` indefinitely.

## Navigation

Prev: [Protocol](protocol.md) · Next: [Persona](persona.md)
