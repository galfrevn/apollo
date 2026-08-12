# Skill provenance

The skills here are **vendored copies** from the open skills registry (<https://skills.sh>),
not original work. They arrived via `.cursor/skills/`, were migrated to `.claude/skills/` on
2026-08-12, and were moved to the registry's own layout later the same day.

## Layout

Real files live in `.agents/skills/<name>/` — the default install location for `npx skills`.
`.claude/skills/<name>` is a **symlink** to each one, which is how Claude Code picks them up.
Other agents (Codex, Cursor, OpenCode) link the same directories, so a skill is written once
and read by all of them.

Add a skill with the CLI and it lands in this layout automatically:

```bash
npx skills add <owner/repo@skill>
```

Never create a plain directory under `.claude/skills/` — it would be invisible to every other
agent and to `npx skills update`.

## Why this file exists

Several skills carry **local edits** that adapt them to this repo. `npx skills update`
overwrites a vendored skill wholesale, so it will silently discard those edits. Re-apply
them after any update — the "Local edits" column says what to restore.

## Inventory

`skills-lock.json` is the machine-readable record, but it only covers skills installed
through the CLI. The rest predate it and are pinned only by this table and by git.

### Registry-managed (in `skills-lock.json`)

| Skill | Upstream | Local edits |
|---|---|---|
| `animate` | `emilkowalski/skill@animate` | none |
| `animation-vocabulary` | `emilkowalski/skill@animation-vocabulary` | none |
| `emil-design-eng` | `emilkowalski/skill@emil-design-eng` | none |
| `find-animation-opportunities` | `emilkowalski/skill@find-animation-opportunities` | none |
| `impeccable` | `pbakaus/impeccable@impeccable` | none |
| `improve-animations` | `emilkowalski/skill@improve-animations` | none |

### Vendored before the lock file existed

`npx skills list` reports these as `Source: local`. They are restored from git, not from the
registry.

| Skill | Upstream | Local edits |
|---|---|---|
| `agents-sdk` | `cloudflare/skills@agents-sdk` | none |
| `bun` | `bun.sh@bun` | `name:` lowercased to match the directory (upstream ships `Bun`, which fails to load) |
| `cloudflare` | `cloudflare/skills@cloudflare` | description rescoped as the fallback skill, deferring to the focused ones, and **single-quoted** — the rescoped text contains a `: ` that made the CLI skip the skill on a YAML parse error; `references:` moved under `metadata:` |
| `durable-objects` | `cloudflare/skills@durable-objects` | **bun-test note** — upstream pushes `@cloudflare/vitest-pool-workers`; this repo uses `bun test` |
| `sandbox-sdk` | `cloudflare/skills@sandbox-sdk` — **withdrawn upstream** | none, but it can no longer be reinstalled: the repo now ships `sandbox-stable`, `sandbox-next`, and `sandbox-migrate-to-next` instead. This copy is the only one left; do not delete it without porting to a successor. |
| `standards-review` | `mattpocock/skills` ecosystem — *exact upstream unconfirmed* | renamed from `code-review` to stop it shadowing the built-in `/code-review`; issue lookup retargeted to `gh`; sub-agent opt-in note |
| `typescript-advanced-types` | `wshobson/agents@typescript-advanced-types` | none |
| `workers-best-practices` | `cloudflare/skills@workers-best-practices` | **bun-test note** in `references/rules.md`, same reason as `durable-objects` |
| `wrangler` | `cloudflare/skills@wrangler` | none |

## Dropped during migration

`analyze-logs` and `build-audit-logs` (both evlog-specific; evlog is not used here) and
`find-skills` (a meta-skill for installing skills — use `npx skills find` directly).

## Updating

```bash
npx skills find <query>              # search the registry
npx skills add <owner/repo@skill>    # install
npx skills update                    # refresh all — then re-apply the local edits above
```
