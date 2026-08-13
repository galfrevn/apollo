# Apollo Starter

A personal desk agent: this Cloudflare Worker handles voice turns, tools, memory, and background work for an ESP32 device (or any client speaking the Apollo protocol). Entry point `src/index.ts`.

**Read the skills first.** `.claude/skills/` holds the task playbooks — route by task before touching code:

| Task | Skill |
|---|---|
| Deploy / provision / configure from zero | `apollo-setup` |
| Wire contract, firmware or client debugging | `apollo-protocol` |
| Write firmware or a client for new hardware | `apollo-firmware` |
| Change voice, language, timezone, name, region | `apollo-persona` |
| Add/remove tools, MCP servers, enable coding | `apollo-tooling` |
| Debug a live deployment, OTA, costs, upgrades | `apollo-operate` |

For depth, the handbook at `documentation/` is meant to be read in order (start at `documentation/index.md`); `documentation/reference/mapping.md` maps each topic to its `src/` folder.

## Commands

```bash
bun run dev          # wrangler dev — uses the *preview* R2 bucket (apollo-media-preview)
bun run check        # the quality gate: types + typecheck + test — must pass before a change is done
bun run types        # regenerate worker-configuration.d.ts from wrangler.jsonc
bun run bootstrap    # provision / secrets / deploy / verify (see apollo-setup)
bun run probe        # protocol-level client for a live worker
```

## Architecture

Durable Objects hold all state: `Apollo` (the agent, SQLite-backed), plus the `ApolloBackground` and `ApolloCoding` workflows. Bindings: `MEDIA` (R2), `VECTORIZE`, `APOLLO_QUEUE`. The `Sandbox` container binding is an opt-in (see `apollo-tooling`); without it the coding tools degrade with a spoken summary.

`src/` is grouped by capability — one folder per domain (`voice/`, `memory/`, `tools/`, `mcp/`, `ota/`, …), each holding single-word files. `configuration/` holds pure data only; `src/configuration/identity.ts` is the owner seam (voice id, timezone, weather default, email sender).

Tests live beside the code they cover as `__tests__/*.spec.ts`.

# Naming Conventions

**Identifiers must be long and descriptive.** Full words that explain intent. Never abbreviate, never single-letter variables (except `i`/`j` in tight loops). Applies equally to functions, parameters, type names, type parameters, and user-facing strings.

Booleans start with `is`/`has`/`should`/`was`/`did`. Functions start with a verb (`build`, `resolve`, `inspect`, `execute`). Collections end with `List`, `Map`, `Set`, or `Catalog`.

**Filenames are a single lowercase word.** One concept per file. Compose meaning through folders, never through hyphenated or multi-word filenames.

Use the `@/` alias for in-package imports — never relative paths like `../../`. When renaming, update every import.

# Code Quality

**Full type safety, no escape hatches.** Forbidden: `any`, `as any`, `as unknown as X`, `// @ts-ignore`, `// @ts-expect-error`, non-null assertions (`!`) on untrusted data, implicit `any` parameters. Validate every external input with `zod`. Prefer `unknown` over `any` at boundaries. Use `readonly` for properties and arrays that should not mutate. Use discriminated unions instead of optional booleans.

**No comments unless strictly necessary.** Descriptive names document *what*. Only comment a non-obvious *why* — a workaround, trade-off, constraint, or external spec the reader cannot infer from the code.

**Modular, single-responsibility files.** One cohesive concern per file; do not exceed ~300 lines — split when you do. Do not reach into another capability's internals; go through the module it exports. Prefer pure functions over classes. Inject context as the last argument rather than reading globals.

# Import Grouping

Two groups, blank line between, never mixed: **third-party** (Node builtins and npm packages) then **local** (the `@/` alias). Within a group: side-effect imports first, then value imports, then `import type`. Alphabetical by module path where it doesn't hurt readability.

# Deployment gotchas

- `wrangler types` turns each `vars` entry in `wrangler.jsonc` into a **literal** string type; `createFakeApolloEnvironment` in `src/configuration/testing.ts` must repeat the exact value or typecheck fails.
- The Vectorize index must be 1536 dimensions / cosine (pinned to the embedding model); a wrong-dims index fails silently at the first memory write.
- The device instance name (`desk` by convention) is the last segment of the WebSocket URL — device and console must use the same one.
