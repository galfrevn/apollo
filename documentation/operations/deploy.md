# Deploy

Apollo deploys as a Cloudflare Worker named `apollo` with several bindings.

## Bindings

| Binding | Purpose |
|---------|---------|
| `Apollo` Durable Object | Per-desk agent session (SQLite) |
| `MEDIA` R2 | Media objects, TTS cache, research reports |
| `VECTORIZE` | Memory embeddings index (`apollo-memory`) |
| `APOLLO_QUEUE` | Background job queue (`apollo-jobs`) |
| `BACKGROUND` | Workflow binding for `apollo-background` (deep research) |
| `CODING` | Workflow binding for `apollo-coding` (coding tasks) |
| `Sandbox` | Container-backed durable object for sandbox tools (see [Sandbox](../capabilities/sandbox.md)) |

## Secrets

None of these live in `wrangler.jsonc`; set each with `bunx wrangler secret put <NAME>`
(and mirror them in `.dev.vars` locally):

| Secret | Used by |
|--------|---------|
| `DEVICE_SHARED_SECRET` | Device auth ([Auth](auth.md)) |
| `OPENROUTER_API_KEY` | STT, reasoning, embeddings, deep research |
| `ELEVENLABS_API_KEY` | TTS |
| `TAVILY_API_KEY` | Quick `web_search` |
| `RESEND_API_KEY` | `send_email` and research report delivery |
| `GITHUB_APP_ID` | GitHub App used by coding tasks ([Coding](../capabilities/coding.md)) |
| `GITHUB_APP_PRIVATE_KEY` | Same App — PKCS#8 PEM ([Coding](../capabilities/coding.md)) |

## Vars

Plain vars in `wrangler.jsonc`: `OPENROUTER_MODEL`, `OPENROUTER_STT_MODEL`,
`OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_CODING_MODEL`, `OPENROUTER_EMBEDDING_MODEL`,
`ELEVENLABS_TTS_MODEL`, and `APOLLO_OWNER_EMAIL` (the pinned recipient for
[Email](../capabilities/email.md)).

Changing a var means editing `wrangler.jsonc` and redeploying. `wrangler types` turns each
var into a *literal* type, so `createFakeApolloEnvironment`
(`src/configuration/testing.ts`) has to repeat the exact same string — a var change that
skips it fails typecheck, not tests.

See `wrangler.jsonc` for the authoritative list and the migration tags.

## Deploy command

Use your usual Wrangler deploy flow after secrets and resources exist in the target account. Do not invent resource names beyond what the config declares.

The `Sandbox` container image is built by the Docker CLI as part of every deploy, including `--dry-run`, so the daemon has to be running. To ship a Worker-only change without it, pass `--containers-rollout=none`.

## Navigation

Prev: [Setup](setup.md) · Next: [Auth](auth.md)
