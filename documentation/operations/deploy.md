# Deploy

Apollo deploys as a Cloudflare Worker named `apollo` with several bindings.

## Notable bindings

| Binding | Purpose |
|---------|---------|
| `Apollo` Durable Object | Per-desk agent session (SQLite) |
| `Sandbox` | Sandbox container DO |
| `MEDIA` R2 | Media objects |
| `VECTORIZE` | Memory embeddings index |
| `TAVILY_API_KEY` | Secret — Tavily search API (quick `web_search`) |
| `APOLLO_QUEUE` | Background job queue |
| Workflows | `apollo-background` long-running work |

See `wrangler.jsonc` for the authoritative list, migrations, and model vars.

## Deploy command

Use your usual Wrangler deploy flow after secrets and resources exist in the target account. Do not invent resource names beyond what the config declares.

The `Sandbox` container image is built by the Docker CLI as part of every deploy, including `--dry-run`, so the daemon has to be running. To ship a Worker-only change without it, pass `--containers-rollout=none`.

## Navigation

Prev: [Setup](setup.md) · Next: [Auth](auth.md)
