# Apollo Agent

The Cloudflare Worker that handles voice turns, tools, memory, and background work for Apollo, a personal agent with a physical body. Entry point `src/index.ts`.

See the root `CLAUDE.md` for naming conventions, code quality rules, import grouping, and the monorepo layout — they apply here too.

## Commands

Run from this directory, or from the repo root via `turbo run <task> --filter=@apollo/agent`:

```bash
bun run dev          # wrangler dev — uses the *preview* R2 bucket (apollo-media-preview)
bun test             # bun test, rooted at ./src
bun run typecheck    # tsc --noEmit
bun run types        # regenerate worker-configuration.d.ts from wrangler.jsonc
```

## Architecture

Durable Objects hold all state: `Apollo` (the agent, SQLite-backed), `ApolloBackground`, `ApolloCoding`, and `Sandbox`. Bindings: `MEDIA` (R2), `VECTORIZE`, `APOLLO_QUEUE`.

`src/` is grouped by capability — one folder per domain (`voice/`, `memory/`, `tools/`, `mcp/`, `ota/`, `focus/`, …), each holding single-word files. `configuration/` holds pure data only.

Tests live beside the code they cover as `__tests__/*.spec.ts`.

The device firmware is a submodule at `apps/firmware/apollo-firmware`; the contract between the two repos is `documentation/runtime/protocol.md`.
