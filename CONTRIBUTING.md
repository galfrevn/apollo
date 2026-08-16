# Contributing

Thanks for looking. Apollo is a personal agent with a body: a Cloudflare Worker does the
thinking, an ESP32 carries it. Almost everything worth changing lives on the worker side,
and none of it needs the hardware to work on.

## Get it running

```bash
git clone --recurse-submodules https://github.com/galfrevn/apollo.git
cd apollo
bun install
bunx lefthook install
cp apps/agent/.dev.vars.example apps/agent/.dev.vars
bun run dev
```

Two things bite people:

`apps/firmware/apollo-firmware` is a git submodule. If you already cloned without it, run
`git submodule update --init --recursive`. You only need it to build firmware.

`.dev.vars` has to sit in `apps/agent/`, next to `wrangler.jsonc` — Wrangler resolves it
relative to its own config, so a copy in the repo root is silently ignored and every
authenticated request answers `401` with nothing in the logs. Leave `MOCK_VOICE=1` while
you develop: it skips real STT/TTS and vector recall, so a session costs nothing.

Full detail in [Setup](documentation/operations/setup.md).

## Where things live

| Path | What it is |
|------|------------|
| `apps/agent/` | the Cloudflare Worker — voice turns, tools, memory, background work |
| `apps/console/` | the marketing landing (`/`) and management console (`/console`) |
| `apps/wizard/` | the `create-heyapollo` setup wizard and starter generator |
| `apps/firmware/` | ESP32 firmware, a submodule, not a workspace member |
| `documentation/` | the handbook, meant to be read in order from [index.md](documentation/index.md) |

`documentation/reference/mapping.md` maps each handbook topic to its folder under
`apps/agent/src/`. Read the chapter before changing the behaviour it describes.

## Before you open a pull request

```bash
bun run check
```

That is the gate — lint, format check, typecheck, and tests, about two seconds cold. The
pre-push hook runs typecheck and tests as a backstop, and CI runs the whole thing again.

Two more things CI enforces that are easy to miss:

**The pull request title has to be a conventional commit.** `feat(console): …`,
`fix(agent): …`, `docs(setup): …`. Allowed types are in `commitlint.config.ts`. A title
that does not parse fails the Title check.

**Lines you add need 80% test coverage.** Tests live next to the code they cover as
`__tests__/*.spec.ts` and run on Bun. Keep them deterministic — no live network.

## House style

The rules in [CLAUDE.md](CLAUDE.md) apply to everyone, not just agents. The ones that
actually come up in review:

- **Names are long and descriptive.** Full words, no abbreviations, no single letters
  outside a tight loop. Booleans start with `is`/`has`/`should`; functions start with a
  verb; collections end in `List`/`Map`/`Set`/`Catalog`.
- **Filenames are a single lowercase word.** Compose meaning through folders, never through
  hyphenated names — `src/voice/countdown.ts`, not `src/voice/countdown-arc.ts`.
- **No escape hatches.** No `any`, no `as unknown as`, no `@ts-ignore`, no non-null
  assertions on untrusted data. Validate every external input with `zod`.
- **No comments unless they explain a non-obvious *why*** — a workaround, a constraint, an
  external spec. Names document the *what*.
- **One concern per file**, under about 300 lines.
- **Imports in two groups**, third-party then local `@/`, blank line between.

Formatting is oxfmt's job — run `bun run format` and never hand-format.

## Scope

Small fixes, tests for untested modules, and documentation corrections are always welcome
as a direct pull request. For anything that changes how the agent behaves, open an issue
first so the design gets settled before you write it — `documentation/reference/roadmap.md`
is the honest list of what is open and what is deliberately not being built.

Issues labelled `good first issue` are scoped to be self-contained and server-side, so no
device required.
