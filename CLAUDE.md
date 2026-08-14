# Apollo

A personal agent with a body: it lives in a physical device instead of a chat window. A Cloudflare Worker (`apps/agent/`) handles voice turns, tools, memory, and background work; an ESP32 firmware submodule (`apps/firmware/`) is the reference body; a web app (`apps/console/`) serves the marketing landing at `/` and the management console at `/console`. Turborepo + Bun workspaces.

## Commands

Root scripts proxy through turbo across every workspace; target a single app with `turbo run <task> --filter=@apollo/agent`.

```bash
bun run check        # the full quality gate, ~2s cold
bun run dev          # turbo run dev --filter=@apollo/agent (wrangler dev, preview R2 bucket)
bun run dev:wizard   # setup wizard in a throwaway apps/wizard/.sandbox (real wrangler auth, stubbed bootstrap)
bun run test         # turbo run test
bun run typecheck    # turbo run typecheck
bun run lint         # oxlint --deny-warnings (repo-wide)
bun run format       # oxfmt --write (repo-wide)
bun run types        # turbo run types, regenerates worker-configuration.d.ts
```

**Quality gate — must pass before a change is done:** `bun run check`, which runs lint, format, typecheck, and test. The pre-push hook runs typecheck and test as a backstop.

Formatting is oxfmt's job; never hand-format. Note that oxfmt does *not* sort or group imports — the Import Grouping rules below are enforced by review only.

## Monorepo layout

- `apps/agent/` — the Cloudflare Worker (see `apps/agent/CLAUDE.md`)
- `apps/console/` — marketing landing (`/`) + management dashboard (`/console`) (see `documentation/console/`)
- `apps/firmware/` — ESP32 firmware, a git submodule, not a JS workspace member
- `apps/wizard/` — the `create-heyapollo` npm package: the interactive setup wizard (`src/`, bundled as `dist/setup.js`, never copied into the scaffold), the scaffolder bin (`cli/`), and the starter generator (`generator/`, builds the minimal deployable snapshot from `apps/agent` + the skills into the embedded `template/`)
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
