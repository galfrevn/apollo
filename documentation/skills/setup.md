---
name: apollo-setup
description: From-zero deploy runbook for the Apollo starter — provisioning Cloudflare resources, secrets, identity edits, and first spoken turn. Load when the user says "set this up for me", "deploy Apollo", "provision", "configure my worker", or asks how to get the agent running on their Cloudflare account.
---

# Apollo setup

Deploy the Apollo desk-agent Worker onto the user's own Cloudflare account, from nothing to a verified spoken turn. Follow the phases in order. The bootstrap scripts are the **only** sanctioned way to mutate the Cloudflare account — never run raw `wrangler` create/put/deploy commands yourself (one narrow exception in Troubleshooting).

## Prerequisites

- **bun** installed.
- **A Cloudflare account** — the Workers **free plan is enough** for everything the starter uses: SQLite Durable Objects, R2, Vectorize, Queues (10k operations/day on free), Workflows. Caveat: **R2 requires a payment card on file** even for free-tier usage — enable R2 in the dashboard once before provisioning. **Docker is NOT needed** — the starter ships no Containers block and no `Sandbox` binding. The coding/sandbox opt-in (which needs Workers Paid, $5/mo, plus Docker running at deploy time) is documented in the `apollo-tooling` skill.
- **`bunx wrangler login`** completed in a browser.

## Non-negotiable rules

1. **Keys never enter the chat.** The human pastes every API key directly into `.dev.vars` (gitignored, copied from `.dev.vars.example`). Say this to the user explicitly, and repeat it if they try to paste a key at you.
2. **Account confirmation before mutation.** Run `bun run bootstrap preflight`, state verbatim which account `wrangler whoami` reports, and get an explicit "yes, that account" from the human before `provision` touches anything.
3. All account mutations go through `bun run bootstrap <step>`.

## Phase 1 — the interview

Ask before touching anything:

1. **Which Cloudflare account?** Resolved by preflight + the confirmation rule above.
2. **Which keys do they already have?** OpenRouter, ElevenLabs, Tavily, Resend, a GitHub App. Map answers to the secrets table below; missing optional keys are fine.
3. **Owner email?** `APOLLO_OWNER_EMAIL` is where `send_email` and research reports deliver. With the default Resend sandbox sender (`Apollo <onboarding@resend.dev>` in `src/configuration/identity.ts`), delivery **only reaches the address the Resend account was signed up with** — so it must be that address, or skip email entirely.
4. **Keep or adapt the persona?** Apollo ships as a Rioplatense-Spanish desk companion. Keeping it is zero work. Adapting voice, language, or register routes to the **`apollo-persona`** skill — it is not a setup blocker; deploy first, adapt later.
5. **Device situation?**
   - **Reference board** — Waveshare ESP32-S3 Touch LCD 1.85C V2; firmware reference implementation at https://github.com/galfrevn/apollo-firmware.
   - **Custom hardware** — anything that speaks the protocol in `documentation/runtime/protocol.md` over WebSocket.
   - **No device yet** — deploy in **trial mode**: keep `MOCK_VOICE=1`. This ships a protocol-correct brain with **no paid keys at all**: STT returns the typed text (or `'hola'`), the LLM answers `Mock: <your text>`, TTS "audio" is literally the UTF-8 bytes of the reply text, and vector recall + memory consolidation are skipped. Probe it with `bun run probe`; swap to real keys later and re-run `bootstrap secrets deploy`.

## Phase 2 — secrets into `.dev.vars`

`cp .dev.vars.example .dev.vars`, then the human fills it. Verified behavior per key:

| Key | Missing → | Class |
|---|---|---|
| `OPENROUTER_API_KEY` | Every real turn fails — STT, reasoning, embeddings have no guard in the turn path | **Hard-fail** (unless `MOCK_VOICE=1`) |
| `ELEVENLABS_API_KEY` | TTS synthesis throws; the turn dies with caption "No pude procesar ese pedido, intentá de nuevo." | **Hard-fail** (unless `MOCK_VOICE=1`) |
| `DEVICE_SHARED_SECRET` | Device connections get a clean 401 | **Hard-fail** for devices; bootstrap generates it |
| `DASHBOARD_SHARED_SECRET` | Console connections get a clean 401 | **Hard-fail** for the console; bootstrap generates it |
| `TAVILY_API_KEY` | `web_search` returns a tool error; Apollo speaks "Falló la búsqueda web: …" | Degrades |
| `RESEND_API_KEY` / `APOLLO_OWNER_EMAIL` | `send_email` answers "El email no está configurado todavía (falta RESEND_API_KEY o APOLLO_OWNER_EMAIL)." | Degrades |
| `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` | Coding tools error with "Faltan GITHUB_APP_ID o GITHUB_APP_PRIVATE_KEY" — moot anyway until the sandbox opt-in (`apollo-tooling`) | Degrades |
| `MOCK_VOICE` | Dev/trial only; never pushed as a production secret | — |

Notes:
- Leave `DEVICE_SHARED_SECRET` / `DASHBOARD_SHARED_SECRET` empty — `bootstrap secrets` generates them. They are deliberately **two different secrets**: the device credential is compiled into firmware (rotation costs an OTA), the dashboard credential lives in a browser tab (rotate freely). See `documentation/operations/auth.md`.
- GitHub hands out a PKCS#1 key; the Worker needs PKCS#8: `openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key-pkcs8.pem`.

## Phase 3 — the identity edit

`src/configuration/identity.ts` is the owner seam — every non-secret personal value lives there:

- **`APOLLO_TTS_VOICE`** — ships as a placeholder that **must** be replaced with the user's own ElevenLabs voice id (skip only under `MOCK_VOICE=1`). `eleven_multilingual_v2` takes no `language_code`, so accent lives in the voice itself: pick one from the ElevenLabs Voice Library, add to My Voices, paste its id.
- **`APOLLO_TIME_ZONE`** + **`APOLLO_TIME_ZONE_SPOKEN_LABEL`** — IANA zone plus how Apollo says it aloud (default `'America/Argentina/Buenos_Aires'` / `'hora de Buenos Aires'`).
- **`DEFAULT_DESK_WEATHER_LOCATION`** — `latitude`, `longitude`, `locationLabel`, `timezone` for the desk dashboard.
- **`APOLLO_EMAIL_SENDER`** — default `'Apollo <onboarding@resend.dev>'`, the Resend sandbox sender. It delivers **only to the Resend account owner's own address**; swap for a verified-domain sender to lift that limit.

After any edit, run `bun run types` and `bun run check`.

**Literal-type lockstep:** `wrangler types` turns each plain var in `wrangler.jsonc` (`OPENROUTER_MODEL`, `OPENROUTER_STT_MODEL`, `OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_CODING_MODEL`, `OPENROUTER_EMBEDDING_MODEL`, `ELEVENLABS_TTS_MODEL`) into a **literal** string type. Changing a var therefore requires updating the **exact same string** in `createFakeApolloEnvironment` in `src/configuration/testing.ts`, or typecheck fails — a wanted failure that catches drift.

## Phase 4 — bootstrap

`bun run bootstrap <preflight|provision|secrets|deploy|verify|all>` — run steps individually the first time so each success is visible; `all` is for reruns.

1. **`preflight`** — checks bun and `wrangler whoami`. Success: an account identity prints. **Stop here, state the account to the human, get explicit confirmation.**
2. **`provision`** — idempotently creates: R2 buckets `apollo-media` + `apollo-media-preview` (dev uses the preview bucket), Vectorize index `apollo-memory` with `--dimensions=1536 --metric=cosine`, queue `apollo-jobs`. The dimension count is **pinned to `OPENROUTER_EMBEDDING_MODEL` = `openai/text-embedding-3-small`** (1536-dim vectors). This coupling fails **silently** if broken: a wrong-dims index rejects every insert and query, memory writes vanish and recall returns nothing, but turns keep working — Apollo just never remembers. Success: all four resources exist (rerunning is a no-op).
3. **`secrets`** — generates `DEVICE_SHARED_SECRET` / `DASHBOARD_SHARED_SECRET` into `.dev.vars` when empty, then pipes **every non-empty `.dev.vars` entry except `MOCK_VOICE`** through `wrangler secret put`. Success: each pushed secret named (values never printed).
4. **`deploy`** — `wrangler deploy`. The starter config is `workers_dev` only (no custom routes, no Containers). Success: a `https://apollo.<subdomain>.workers.dev` URL.
5. **`verify`** — hits `GET /health`, expecting `{ ok: true, name: 'apollo', features: ['session','vectorize','r2','queues','workflows'] }`, then opens a WebSocket and performs a `hello` → `ui_state` probe exactly as a device would. Success: both pass.

## Phase 5 — the finish

Hand the user, explicitly:

- **Worker URL**: `https://apollo.<subdomain>.workers.dev`
- **Device WebSocket URL**: `wss://apollo.<subdomain>.workers.dev/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>` — the instance name is `desk`; this is what goes into firmware config.
- **Where the secrets live**: both shared secrets are in `.dev.vars` locally and as Worker secrets remotely.
- **Hosted console**: https://heyapollo.dev/console connects to any deployment — enter the worker URL, instance name `desk`, and `DASHBOARD_SHARED_SECRET`; all three are stored locally in the browser, nothing is sent to heyapollo.dev's backend.
- **One real turn**, spoken from the device if one is flashed, otherwise:

```sh
bun run probe -- --url wss://apollo.<subdomain>.workers.dev/agents/apollo/desk \
  --token <DEVICE_SHARED_SECRET> --text "hola"
```

sends `hello` plus a `text_input` turn and prints every frame. Under `MOCK_VOICE=1` expect the reply text `Mock: hola` and binary frames that are its UTF-8 bytes.

## Troubleshooting

- **`provision` fails on R2** — the account has not enabled R2 yet. Enable it in the Cloudflare dashboard (requires a payment card on file even for free usage), rerun `bun run bootstrap provision`.
- **Memory never sticks / Vectorize errors in logs** — the index exists with wrong dimensions (dims cannot be changed in place). Fix: `bunx wrangler vectorize delete apollo-memory` — the one sanctioned raw-wrangler mutation, since provision never deletes — then `bun run bootstrap provision` to recreate it at 1536/cosine. Stored memories are lost; conversation history (Durable Object SQLite) is not.
- **Turns fail with "No pude procesar ese pedido, intentá de nuevo."** — with `MOCK_VOICE` off, this is almost always a missing/invalid `ELEVENLABS_API_KEY`, a missing `OPENROUTER_API_KEY`, or the `APOLLO_TTS_VOICE` placeholder in `src/configuration/identity.ts` never replaced with a real voice id. Fix the value, rerun `bootstrap secrets` (for keys) or `bootstrap deploy` (for the identity edit).
- **401 on connect** — token mismatch: the device must present `DEVICE_SHARED_SECRET`, the console `DASHBOARD_SHARED_SECRET`, as the `?token=` query parameter. They are not interchangeable.
- **`/health` feature list** — `session`, `vectorize`, `r2`, `queues`, `workflows` always; **`coding` appears only when the `Sandbox` Durable Object binding exists**, i.e. after the Containers opt-in from `apollo-tooling`. Its absence is the expected starter state, and coding tools answer with the spoken summary "No puedo programar en este despliegue: el sandbox de Cloudflare Containers no está habilitado."
