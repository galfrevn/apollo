# Setup

Local development uses Bun for scripts/tests and Wrangler for the Workers runtime.

## Prerequisites

- Bun
- Cloudflare account + Wrangler auth for remote bindings you exercise locally
- Secrets required by voice/search providers (for example OpenRouter)

## Install

```bash
bun install
cp .dev.vars.example .dev.vars
```

Fill `.dev.vars` with at least `DEVICE_SHARED_SECRET` and `OPENROUTER_API_KEY`, and leave `MOCK_VOICE=1` — it skips real STT/TTS *and* vector recall locally, so a dev session costs nothing in ElevenLabs credits or embedding calls.

`ELEVENLABS_API_KEY` is the one key with no graceful fallback: with `MOCK_VOICE` off and no key, ElevenLabs answers 401, `synthesizeSpeechWithElevenLabs` throws, and the turn fails with "no pude procesar ese pedido". The other two degrade to something the agent can say — `TAVILY_API_KEY` (`web_search`) returns a tool error, `RESEND_API_KEY` (`send_email`) returns "el email no está configurado todavía". Full list with prod instructions in [Deploy](deploy.md).

## Run locally

```bash
bun run dev
```

Wrangler serves the Worker (default `http://127.0.0.1:8787`). Sandbox/Containers need Docker running if you exercise that path.

## Useful scripts

From `package.json`:

| Script | Purpose |
|--------|---------|
| `bun run check` | Full quality gate: lint, format, typecheck, test |
| `bun run dev` | Local Worker via Wrangler |
| `bun run deploy` | Deploy Worker to Cloudflare |
| `bun run typecheck` | TypeScript `--noEmit` |
| `bun run lint` | Oxlint with deny-warnings |
| `bun run format` | Oxfmt write |
| `bun run format:check` | Oxfmt check without writing |
| `bun test` | Unit/integration tests |
| `bun run test:coverage` | Tests with coverage |
| `bun run types` | Regenerate Wrangler types |

## Configuration

- Worker config: `apps/agent/wrangler.jsonc`
- Local secrets: `.dev.vars` (from `.dev.vars.example`)
- Path alias `@/` → `apps/agent/src/` (see `apps/agent/tsconfig.json`)

## Navigation

Prev: [MCP servers](../capabilities/mcp.md) · Next: [Deploy](deploy.md)
