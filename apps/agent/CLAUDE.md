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

Platform coupling is isolated behind ports: interfaces in `src/platform/` (`BlobStore`, `VectorStore`, `JobPublisher`, `RunLauncher`, `StepRunner`), Cloudflare adapters in `src/platform/cloudflare/`, portable workflow bodies in `src/runs/`. New code takes a port, never a binding type; see `documentation/reference/portability.md`.

Tests live beside the code they cover as `__tests__/*.spec.ts`.

The device firmware is a submodule at `apps/firmware/apollo-firmware`; the contract between the two repos is `documentation/runtime/protocol.md`.

## This app ships to strangers

`src/` is copied verbatim into the public `apollo-starter` snapshot and into the `template/` that `create-heyapollo` clones for users (`apps/wizard/generator/build.ts`). A change here is a change to what someone else deploys on their own Cloudflare account, so it has to hold four invariants — stated in full, with the machinery behind them, in [Starter](../../documentation/reference/starter.md):

1. **New binding or secret** → the starter inherits it automatically. Decide which it is: optional for a stranger (declare it in `src/configuration/environment.d.ts` and degrade gracefully) or provisioned at setup (add it to `apps/wizard/generator/assets/scripts/bootstrap.ts` and the `apollo-setup` skill).
2. **No owner value in tracked source** — not the owner's email, the ElevenLabs voice id, or the `heyapollo` host. It belongs in `src/configuration/identity.ts` or a secret. The generator's guard fails the build if one leaks.
3. **Changed wire constant** → update the skill in `documentation/skills/` that quotes it. `apps/wizard/__tests__/anchors.spec.ts` names the pair and runs in `bun run check`.
4. **Reshaped `src/configuration/identity.ts`** → update the generator manifest's placeholder swap and the wizard rewriters in the same change. The swap is anchored to an exact line and drift fails the build.

`.github/workflows/starter.yml` regenerates and smoke-builds the starter on every push or pull request touching this app, so drift surfaces at pull request time instead of in a stranger's terminal. Reproduce it locally with `bun apps/wizard/generator/build.ts --smoke`.
