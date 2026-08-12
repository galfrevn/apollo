# Apollo

A personal desk agent for an ESP32 device: a Cloudflare Worker (`apps/agent/`) that handles voice turns, tools, memory, and background work, an ESP32 firmware submodule (`apps/firmware/`), and a management dashboard (`apps/console/`, not yet built). Turborepo + Bun workspaces.

## Commands

Root scripts proxy through turbo; target a single app directly with `turbo run <task> --filter=@apollo/agent`.

```bash
bun run dev          # turbo run dev --filter=@apollo/agent (wrangler dev, preview R2 bucket)
bun run test         # turbo run test --filter=@apollo/agent
bun run typecheck    # turbo run typecheck --filter=@apollo/agent
bun run lint         # oxlint --deny-warnings (repo-wide)
bun run format       # oxfmt --write (repo-wide)
bun run types        # turbo run types --filter=@apollo/agent, regenerates worker-configuration.d.ts
```

**Quality gate — all three must pass before a change is done:** `bun run typecheck`, `bun run lint`, `bun run test`.

Formatting is oxfmt's job; never hand-format. Note that oxfmt does *not* sort or group imports — the Import Grouping rules below are enforced by review only.

## Monorepo layout

- `apps/agent/` — the Cloudflare Worker (see `apps/agent/CLAUDE.md`)
- `apps/console/` — management dashboard (not yet built)
- `apps/firmware/` — ESP32 firmware, a git submodule, not a JS workspace member
- `packages/typescript-config/` — shared base tsconfig

**Read `documentation/` before changing agent behavior** — it's a handbook meant to be read in order, and `documentation/reference/mapping.md` maps each topic to its `apps/agent/src/` folder. Start at `documentation/index.md`.

Pushes to `main` deploy the agent automatically (`.github/workflows/deploy.yml`), skipping doc-only changes.

# Naming Conventions

**Identifiers must be long and descriptive.** Full words that explain intent. Never abbreviate, never single-letter variables (except `i`/`j` in tight loops). Applies equally to functions, parameters, type names, type parameters, and user-facing strings.

```ts
// ❌ const u = await db.q('select * from users');
// ✅ const allRegisteredUserList = await database.query('select * from users');
```

Booleans start with `is`/`has`/`should`/`was`/`did`. Functions start with a verb (`build`, `resolve`, `inspect`, `execute`). Collections end with `List`, `Map`, `Set`, or `Catalog`.

**Filenames are a single lowercase word.** One concept per file. Compose meaning through folders, never through hyphenated or multi-word filenames — if a name needs two words to be unambiguous, make a folder for the concern and put the single-word file inside.

```
❌ src/mcp/server-settings-adapter.ts     ✅ src/mcp/settings.ts
❌ src/voice/countdown-arc.ts             ✅ src/voice/countdown.ts
```

Use the `@/` alias for in-package imports — never relative paths like `../../`. When renaming, update every import.

# Code Quality

**Full type safety, no escape hatches.** Forbidden: `any`, `as any`, `as unknown as X`, `// @ts-ignore`, `// @ts-expect-error`, non-null assertions (`!`) on untrusted data, implicit `any` parameters. Validate every external input with `zod`.

```ts
// ❌ function handle(payload: any) { return payload.user.id as string; }
// ✅ const schema = z.object({ user: z.object({ id: z.string() }) });
//    function handleIncomingPayload(raw: unknown): string { return schema.parse(raw).user.id; }
```

Prefer `unknown` over `any` at boundaries. Use `readonly` for properties and arrays that should not mutate. Use discriminated unions instead of optional booleans.

**No comments unless strictly necessary.** Descriptive names document *what*. Only comment a non-obvious *why* — a workaround, trade-off, constraint, or external spec the reader cannot infer from the code.

```ts
// ❌ Increment the counter
// ✅ Postgres rejects identifiers longer than 63 bytes; truncate before sending.
```

Never use comments to talk to the user, log progress, or annotate diffs.

**Modular, single-responsibility files.** One cohesive concern per file; do not exceed ~300 lines — split when you do. Do not reach into another capability's internals; go through the module it exports. Prefer pure functions over classes. Inject context as the last argument rather than reading globals. Keep public exports explicit; do not re-export everything.

# Import Grouping

Two groups, blank line between, never mixed:

1. **Third-party** — Node builtins and npm packages (`agents`, `zod`, …)
2. **Local** — the `@/` alias and relative paths

Within a group: side-effect imports first, then value imports, then `import type`. Alphabetical by module path where it doesn't hurt readability. Omit empty groups.

```ts
import { Agent } from 'agents';
import type { Session } from 'agents/experimental/memory/session';
import { z } from 'zod';

import { buildDeskDashboardPayload } from '@/agents/dashboard';
```
