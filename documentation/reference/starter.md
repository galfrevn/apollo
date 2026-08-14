# Starter

How the public `apollo-starter` snapshot is produced, verified, and released. This chapter is maintainer documentation: it describes monorepo machinery and is deliberately excluded from the starter export itself.

## What the starter is

A standalone, de-personalized copy of the brain that strangers deploy on their own Cloudflare account. It contains `apps/agent/src` verbatim, a transformed `wrangler.jsonc`, the handbook (minus owner-specific chapters), six agent skills, the bootstrap/probe scripts, and the setup wizard. It never contains the console, the landing, the firmware submodule, or any owner value (email, voice id, custom domain).

## The pipeline

```
apps/agent/src ──────────────┐
documentation/skills/ ───────┤──▶ apps/wizard/generator/build.ts ──▶ apps/wizard/generator/out/
apps/wizard/generator/assets ┘        guard + smoke                (gitignored)
```

The scaffold is the least necessary to deploy Apollo: agent source, wrangler config, bootstrap/probe scripts, and the agent skills. The handbook stays in the monorepo (skills link to it on GitHub), and the wizard is never copied — it ships bundled inside the `create-heyapollo` package and runs against the scaffold via `bun run setup` → `bunx create-heyapollo setup`.

`bun apps/wizard/generator/build.ts` generates; `--smoke` additionally copies the output to a temp directory, runs `bun install`, the starter's own `bun run check` (types + typecheck + the full agent test suite against the container-less config), and `wrangler deploy --dry-run`. The declarative inputs live in `apps/wizard/generator/manifest.ts`, the pure config transforms in `apps/wizard/generator/transform.ts`; `build.ts` only copies, substitutes, and deletes — a transform that would need real code surgery is a signal to genericize `apps/agent` instead.

## Transforms

- **wrangler.jsonc** — parsed (comment-tolerant, `apps/wizard/generator/jsonc.ts`), then: `routes` removed, `workers_dev` forced on, the `containers` block, `Sandbox` Durable Object binding, and its migration entry removed. Re-enabling coding is the `apollo-tooling` skill's runbook.
- **Identity placeholder** — the owner's voice id line in `src/configuration/identity.ts` becomes `APOLLO_TTS_VOICE = ''`. The swap is anchored to the exact line; drift fails the build.
- **Skills** — each `documentation/skills/<name>.md` (frontmatter `name: apollo-<name>`) becomes `.claude/skills/apollo-<name>/SKILL.md` with `documentation/` references rewritten to monorepo GitHub links, and `CLAUDE.md`/`AGENTS.md` route agents to them.
- **Package manifest** — dependencies come from `apps/agent/package.json`, tool versions are read from the root manifest, and `setup` delegates to `bunx create-heyapollo setup`. Nothing is hand-pinned in the generator.

## Guards against drift and leaks

- **Forbidden strings** (`apps/wizard/generator/guard.ts`, rules in the manifest): the build fails if the output contains the owner's email, voice id, or `heyapollo` outside the explicitly allowed files. Adding a personal literal to `apps/agent` breaks the starter build the same day, forcing the genericization conversation at PR time.
- **Freshness anchors** (`apps/wizard/__tests__/anchors.spec.ts`, runs in `bun run check`): wire constants the skills quote (audio floor, chunk size, sample rates, segment length, confirm timeout, Vectorize dimensions, the `[[escucho]]` marker) are extracted from source and asserted against the skill files. Changing a constant without updating its skill fails the monorepo gate.
- **Wizard identity anchors** (`apps/wizard/__tests__/identity.spec.ts`): the wizard's rewrites are tested against the real `identity.ts` with the generator's placeholder swap applied, so reshaping the identity seam without updating the wizard fails typecheck-adjacent tests, not a stranger's setup.
- **Smoke in CI** (`.github/workflows/starter.yml`): every push or PR touching `apps/agent/**`, `documentation/**`, or `apps/wizard/**` regenerates and smoke-builds the starter.

## npm distribution: `create-heyapollo`

The same `apps/wizard` package publishes the one-command path — `bun create heyapollo` / `npm create heyapollo`. The package embeds the generated starter as its `template/` directory (no cloning, no network fetch at scaffold time): `prepack` regenerates the starter and copies `apps/wizard/generator/out` in, then bundles the Node-target bin plus the Bun-target wizard (`dist/setup.js`). The bin scaffolds, renames the undotted `gitignore` back (npm drops `.gitignore` files from packages), initializes git, runs `bun install`, and hands off to the wizard; `--no-install`, `--no-setup`, and `--no-git` opt out. The **first** publish is `cd apps/wizard && npm publish` from a logged-in npm account; after that, configure npm Trusted Publishing for the package (GitHub Actions, repository `galfrevn/apollo`, workflow `publish.yml`) and every release is a version bump: merge a PR that raises the version in `apps/wizard/package.json`, and `.github/workflows/tag.yml` cuts the matching `create-v<version>` tag and dispatches `.github/workflows/publish.yml`, which smoke-builds the embedded starter and publishes with provenance over OIDC — no npm token secret anywhere. The dispatch exists because a tag pushed with the workflow token never fires tag-triggered workflows; pushing a `create-v<version>` tag by hand still publishes through the tag trigger, and the tag version must always match the package version.

## Releasing

Push a tag `starter-v<version>` — `.github/workflows/release.yml` regenerates, smoke-builds, and force-pushes the snapshot (with a matching `v<version>` tag) to the public starter repository, stamping the originating monorepo commit in the snapshot's commit message. Users consume tagged snapshots via degit or `npm create cloudflare -- --template=...`; they are detached copies by design, and upgrades are the diff-and-merge flow documented in the `apollo-operate` skill. The push needs the `STARTER_DEPLOY_TOKEN` secret: a fine-grained PAT with Contents read/write on the starter repository.

## Invariants when changing `apps/agent`

1. New binding or secret → the starter inherits it automatically; decide whether it is optional for strangers (declare it in `src/configuration/environment.d.ts` and degrade gracefully) or provisioned by `bootstrap` (add it to `apps/wizard/generator/assets/scripts/bootstrap.ts` and the `apollo-setup` skill).
2. New personal value → it belongs in `src/configuration/identity.ts` or a secret, never a tracked literal; the guard enforces this after the fact.
3. Changed wire constant → update the skill that quotes it; the anchor test names the pair.
4. Reshaped `identity.ts` → update the manifest's placeholder swap and the wizard rewriters together.

## Navigation

Prev: [Roadmap](roadmap.md)
