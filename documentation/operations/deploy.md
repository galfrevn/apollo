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
| `APOLLO_OWNER_EMAIL` | Pinned recipient for `send_email` and research reports ([Email](../capabilities/email.md)) |
| `GITHUB_APP_ID` | GitHub App used by coding tasks ([Coding](../capabilities/coding.md)) |
| `GITHUB_APP_PRIVATE_KEY` | Same App — PKCS#8 PEM ([Coding](../capabilities/coding.md)) |

## Vars

Plain vars in `wrangler.jsonc`: `OPENROUTER_MODEL`, `OPENROUTER_STT_MODEL`,
`OPENROUTER_RESEARCH_MODEL`, `OPENROUTER_CODING_MODEL`, `OPENROUTER_EMBEDDING_MODEL`,
and `ELEVENLABS_TTS_MODEL`.

Changing a var means editing `wrangler.jsonc` and redeploying. `wrangler types` turns each
var into a *literal* type, so `createFakeApolloEnvironment`
(`src/configuration/testing.ts`) has to repeat the exact same string — a var change that
skips it fails typecheck, not tests.

See `wrangler.jsonc` for the authoritative list and the migration tags.

## Deploy command

Use your usual Wrangler deploy flow after secrets and resources exist in the target account. Do not invent resource names beyond what the config declares.

The `Sandbox` container image is built by the Docker CLI as part of every deploy, including `--dry-run`, so the daemon has to be running. To ship a Worker-only change without it, pass `--containers-rollout=none`.

## Publishing firmware (OTA)

The device self-updates from the `MEDIA` bucket (see [Protocol](../runtime/protocol.md#ota-endpoints)). Layout:

- `firmware/latest.json` — `{ "version": "2.5.0", "key": "firmware/apollo-2.5.0.bin" }`
- `firmware/apollo-<version>.bin` — the app image

Rules that keep devices alive:

- `version` must match `/^\d+(\.\d+)*$/` — digits and dots only. The worker refuses
  anything else (`src/ota/manifest.ts`), because the device's version parser aborts on
  non-numeric segments.
- Upload the **app image** (`build/xiaozhi.bin`), never `build/merged-binary.bin` — the
  merged binary contains the bootloader and partition table and would corrupt an OTA slot.
- Upload the binary before the manifest, so a check never resolves a manifest whose
  binary is not there yet.

```sh
bunx wrangler r2 object put apollo-media/firmware/apollo-2.5.0.bin \
  --file firmware/apollo-firmware/build/xiaozhi.bin \
  --content-type application/octet-stream --remote
bunx wrangler r2 object put apollo-media/firmware/latest.json \
  --file latest.json --content-type application/json --remote
```

The device checks at boot only, so a running device picks the update up on its next
power cycle. Smoke-test after publishing:
`curl -s "https://<worker>/ota/check?token=$TOKEN"` should answer with the new version,
and `curl -sI "https://<worker>/ota/firmware.bin?token=$TOKEN"` with a 200 and the
binary's exact `Content-Length`.

## Navigation

Prev: [Setup](setup.md) · Next: [Auth](auth.md)
