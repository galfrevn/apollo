---
name: apollo-persona
description: Adapt Apollo's identity, voice, language, and region — change the ElevenLabs voice, make Apollo speak a language other than Rioplatense Spanish, move the timezone/city/weather default, rename the assistant, or strip Argentina-specific behavior like the dollar_rate tool. Load for any "make it sound like X", "speak English/Mexican Spanish/…", "change the city", or "rename it" request.
---

# Apollo Persona: identity, voice, language, region

Apollo ships as a Rioplatense-Spanish desk assistant for Buenos Aires. Everything personal-but-not-secret sits in one file; a full language swap is a mechanical multi-file edit with no locale abstraction to lean on. This skill maps both.

## 1. The one-file surface: `src/configuration/identity.ts`

The "owner seam" — every non-secret personal value. Edit here first; most regional requests end here.

| Constant | Ships as | Runtime effect |
|---|---|---|
| `APOLLO_TTS_VOICE` | placeholder — user must fill in their own ElevenLabs voice id | Passed as `voiceId` to every TTS call (`src/agents/runtime.ts`, `src/turn/run.ts`, and the `ttsVoiceId` fields in `src/agents/apollo.ts`) |
| `APOLLO_TIME_ZONE` | `'America/Argentina/Buenos_Aires'` | Timezone for the per-turn clock note (`src/persona/clock.ts`) — the model has no clock; this stamps every prompt with wall time |
| `APOLLO_TIME_ZONE_SPOKEN_LABEL` | `'hora de Buenos Aires'` | Spoken label inside that clock note: `Fecha y hora actual: … (hora de Buenos Aires).` |
| `DEFAULT_DESK_WEATHER_LOCATION` | `{ latitude: -34.6037, longitude: -58.3816, locationLabel: 'Buenos Aires', timezone: APOLLO_TIME_ZONE }` | Weather fallback until the user saves their own city via `set_weather_location` |
| `APOLLO_EMAIL_SENDER` | `'Apollo <onboarding@resend.dev>'` | Resend sender. The sandbox sender `onboarding@resend.dev` only delivers to the Resend account owner's own address — fine for Apollo's owner-only reports. Swap for a verified-domain sender to lift that limit |

**Picking a voice**: ElevenLabs Voice Library → filter by language/accent → "Add to My Voices" → paste the id into `APOLLO_TTS_VOICE`. The TTS request (`src/voice/elevenlabs.ts`, `synthesizeSpeechWithElevenLabs`) sends **no `language_code`** — `eleven_multilingual_v2` rejects it — so the accent lives entirely in the voice you pick. A US-English Apollo means picking an English voice; no other TTS change needed.

**Cache note**: production TTS is cached in R2 under `tts-cache/` keyed by SHA-256 of voice+model+text (`src/voice/ttscache.ts`). Changing the voice creates new keys automatically; old entries become garbage you can bulk-delete by prefix. Never a correctness problem.

## 2. Full language swap — the honest scope

There is **no locale abstraction**. Spanish is hard-coded across prompts, tool strings, and formatters. Changing the spoken language is a file-by-file sweep. Execute this checklist mechanically:

1. **`src/persona/soul.ts`** — translate `apolloIdentityPrompt` ("Sos Apollo, asistente de escritorio en español rioplatense…"), `apolloOperatingBasePrompt` (names every builtin tool in Spanish prose), and the string in `buildInstalledToolPromptNote` ("Tenés herramientas conectadas por el dueño: …").
2. **`src/persona/catalog.ts`** — the four speech modes (`default`, `nerd`, `playful`, `warm`) carry Spanish `promptOverride` strings; `playful` is explicitly Argentine ("muy argentino, joda liviana, jerga natural (boludo, etc.)"). Rewrite all four for the target language/culture — `playful` needs a cultural replacement, not a translation. Keep the ids: `migrateLegacySpeechModeId` and the device's mode-cycling gesture depend on them. `accentColor` per mode drives the on-device face; leave untouched.
3. **STT language** — `src/voice/stt.ts`, `transcribeAudioWithOpenRouter`, the request body line `language: input.languageCode ?? 'es'`. Change the `'es'` default (Whisper language code, e.g. `'en'`, `'pt'`).
4. **Clock locale** — `src/persona/clock.ts`, `formatCurrentDateTimeForPrompt` uses `new Intl.DateTimeFormat('es-AR', …)`. Change `'es-AR'` and translate the instruction sentence in `buildCurrentTimePromptNote` ("Usala para responder qué hora o día es…"). Also update `APOLLO_TIME_ZONE_SPOKEN_LABEL` in identity.ts.
5. **Geocoding language** — `src/weather/geocode.ts` requests Open-Meteo geocoding with `language: 'es'`.
6. **Every tool string in `src/tools/`** — descriptions the model reads, spoken `summary` strings the device says out loud, and error messages. Measured across the 20 tool files (tests excluded): **31 `description:` strings and 81 `summary:` sites**, nearly all Spanish. These summaries are also what the confirm flow speaks for unsafe tools (stored via `src/tools/pending.ts`), so translating them covers confirmation prompts too. Find them all:

   ```bash
   grep -rn "description:\|summary:" src/tools --include="*.ts" | grep -v __tests__
   grep -rn "throw new Error('.*[a-z]" src/voice src/tools src/rates --include="*.ts" | grep -v __tests__
   ```

   Spanish also hides in thrown errors that reach speech — e.g. `src/voice/stt.ts` throws `` `STT falló con status …` `` and `'STT devolvió texto vacío'`.
7. **`src/sandbox/capability.ts`** — two Spanish spoken degradation summaries, `SANDBOX_UNAVAILABLE_SPOKEN_SUMMARY` and `CODING_UNAVAILABLE_SPOKEN_SUMMARY`, spoken verbatim when the deployment has no Containers/Sandbox binding.
8. **The `[[escucho]]` listen marker** — `soul.ts` instructs the model to end replies with `[[escucho]]` when it expects an answer; `src/turn/run.ts` detects it with `/\[\[escucho\]\]/i` and strips it before TTS (the flag keeps the mic open). The mechanism is language-neutral — it's a literal token the model parrots — so the safest move is to keep the literal `[[escucho]]` marker even in an English prompt ("end with the mark [[escucho]]"). If you insist on renaming it (e.g. `[[listening]]`), change the prompt sentence in `soul.ts` **and both regexes** in `src/turn/run.ts` together.
9. **Tests** — several specs assert Spanish substrings (tool summaries, mode prompts). Run `bun run check` and fix assertions as you go.

## 3. Renaming the assistant

Separate identity from infrastructure:

- **Identity (safe to rename)**: the name the device speaks. Change "Apollo" in `apolloIdentityPrompt` (`src/persona/soul.ts`) and the display name in `APOLLO_EMAIL_SENDER` (`'Apollo <…>'`). The wake word is firmware-side and out of scope for this repo.
- **Infrastructure (leave alone)**: the `agents` package's `routeAgentRequest` (`src/index.ts`) maps URLs of the form `/agents/<kebab-cased-binding-name>/<instance>` to the Durable Object binding — the binding is `"name": "Apollo"` / `"class_name": "Apollo"` in `wrangler.jsonc`, which yields the path segment `apollo`. The device firmware and the console both connect to `/agents/apollo/desk`. Renaming the binding or the exported `Apollo` class silently changes that URL and breaks every existing client, plus the auth specs in `src/auth/__tests__/` that hard-code the path — and renaming a Durable Object class also orphans its stored SQLite state unless you write a migration.

**Recommendation**: rename the spoken identity only. Keep `Apollo` as binding, class, and route path.

## 4. Removing Argentina behavior: `dollar_rate` (worked example)

`dollar_rate` fetches Argentine peso exchange rates (blue, oficial, MEP, …) from the free keyless `dolarapi.com`. It is the canonical locale-specific tool; use its removal as the template for any other.

**To delete it** (four touch points):

1. `src/tools/catalog.ts` — remove the `import { dollarRateTool } from '@/tools/dollar';` line and the `dollarRateTool,` entry in `listBuiltinToolDefinitionList`.
2. Delete `src/tools/dollar.ts` and `src/rates/dollar.ts` (the dolarapi client).
3. `src/persona/soul.ts` — remove the prompt sentence fragment `'dollar_rate para cotizaciones del dólar. '` from `apolloOperatingBasePrompt` (the prompt names every builtin in prose; a ghost mention makes the model call a tool that no longer exists).
4. Delete the tests: `src/tools/__tests__/dollar.spec.ts` and `src/rates/__tests__/`.

**To replace it** for your country: keep the same shape — a pure fetch client in `src/rates/` (zod-validated response), a `ToolDefinition` in `src/tools/` with `safety: 'safe'`, speakable summary formatters (note `dollar.ts` uses `Intl.NumberFormat('es-AR')` for peso amounts — pick your locale), register it in `catalog.ts`, and name it in the `soul.ts` operating prompt.

## 5. The regeneration trap: wrangler vars are literal types

`bun run types` regenerates `worker-configuration.d.ts` from `wrangler.jsonc`, and each `vars` entry becomes a **literal string type** — e.g. `ELEVENLABS_TTS_MODEL: 'eleven_multilingual_v2'`, not `string`. The fake environment in `src/configuration/testing.ts` (`createFakeApolloEnvironment`) must repeat each var's **exact** value. If you change any var in `wrangler.jsonc` (say, swapping `ELEVENLABS_TTS_MODEL` to `eleven_flash_v2_5`, or `OPENROUTER_STT_MODEL`), you must:

1. `bun run types` to regenerate the literal types
2. Update the same string in `createFakeApolloEnvironment` to match exactly

or `bun run typecheck` fails with a literal-type mismatch. This is by design — it makes config drift between tests and deployment impossible.

## 6. Scope warnings: language is baked into stored data

Memories (`remember_fact`), thread summaries, and stored preferences are written **in the language the deployment spoke at the time**. A language swap on a live deployment does not translate anything already stored: old memories stay in Spanish and get injected into the (now-English) prompt as-is, which the model handles but the effect is messy — recalled facts read back in the old language.

**Do the language swap before first real use.** On a live device, either accept mixed-language memory or wipe the agent's stored state (the Durable Object's SQLite plus the Vectorize index) and start clean.

Anything headed for TTS also passes `sanitizeTextForSpeech` (`src/voice/sanitize.ts`) so markdown never gets read aloud — that layer is language-neutral and needs no changes.

## Verification

After any persona change: `bun run check` (lint + format + typecheck + test). For a language swap, additionally re-run the tool grep from section 2 and confirm zero remaining strings in the old language outside comments.
