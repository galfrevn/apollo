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

Fill `.dev.vars` with at least `DEVICE_SHARED_SECRET` and `OPENROUTER_API_KEY` (leave `MOCK_VOICE=1` to skip real STT/TTS locally).

## Run locally

```bash
bun run dev
```

Wrangler serves the Worker (default `http://127.0.0.1:8787`). Sandbox/Containers need Docker running if you exercise that path.

## Useful scripts

From `package.json`:

| Script | Purpose |
|--------|---------|
| `bun run dev` | Local Worker via Wrangler |
| `bun run deploy` | Deploy Worker to Cloudflare |
| `bun run typecheck` | TypeScript `--noEmit` |
| `bun run lint` | Oxlint with deny-warnings |
| `bun run format` | Oxfmt write |
| `bun test` | Unit/integration tests |
| `bun run types` | Regenerate Wrangler types |

## Configuration

- Worker config: `wrangler.jsonc`
- Local secrets: `.dev.vars` (from `.dev.vars.example`)
- Path alias `@/` → `src/` (see `tsconfig.json`)

## Navigation

Prev: [Sandbox](../capabilities/sandbox.md) · Next: [Deploy](deploy.md)
