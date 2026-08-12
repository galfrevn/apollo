# Skill provenance

The skills in `.claude/skills/` are **vendored copies** from the open skills registry
(<https://skills.sh>), not original work. They arrived here via `.cursor/skills/` and were
migrated to `.claude/skills/` on 2026-08-12.

## Why this file exists

Several skills carry **local edits** that adapt them to this repo. `npx skills update`
overwrites a vendored skill wholesale, so it will silently discard those edits. Re-apply
them after any update — the "Local edits" column says what to restore.

## Inventory

| Skill | Upstream | Local edits |
|---|---|---|
| `agents-sdk` | `cloudflare/skills@agents-sdk` | none |
| `bun` | `bun.sh@bun` | `name:` lowercased to match the directory (upstream ships `Bun`, which fails to load) |
| `cloudflare` | `cloudflare/skills@cloudflare` | description rescoped as the fallback skill, deferring to the focused ones; `references:` moved under `metadata:` |
| `durable-objects` | `cloudflare/skills@durable-objects` | **bun-test note** — upstream pushes `@cloudflare/vitest-pool-workers`; this repo uses `bun test` |
| `sandbox-sdk` | `cloudflare/skills@sandbox-sdk` | none |
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
