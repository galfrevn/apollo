---
name: apollo-operate
description: Day-2 operations for a deployed Apollo starter — debugging a live worker with bootstrap verify and wrangler tail, publishing firmware over OTA to the R2 bucket, reading device telemetry and reconnect behavior, understanding Cloudflare free-tier ceilings and ElevenLabs/OpenRouter costs, maintaining memory data, and upgrading from an upstream tagged snapshot.
---

# Apollo — operating a live deployment

Worker name: `apollo`. Agent WebSocket: `wss://<host>/agents/apollo/<instance>` (the hosted console at https://heyapollo.dev/console connects with your worker URL + instance name + dashboard secret — the instance name must match exactly, e.g. `desk`). Auth is always a `?token=` query parameter: `DEVICE_SHARED_SECRET` for the device role, `DASHBOARD_SHARED_SECRET` for browsers (see `documentation/operations/auth.md`).

## The doctor loop

```sh
bun run bootstrap verify
```

Verify is the doctor: it hits `GET /health` and runs a WebSocket hello→ui_state probe. `/health` (`src/index.ts`) answers `{ ok: true, name: 'apollo', features: [...] }` — the `features` array proves which bindings resolved (`session`, `vectorize`, `r2`, `queues`, `workflows`, plus `coding` only when the Sandbox container binding exists).

| Failure | Meaning | Fix |
|---|---|---|
| R2 bucket missing | `MEDIA` binding has no bucket | `bunx wrangler r2 bucket create apollo-media` (and `apollo-media-preview` for `wrangler dev`); R2 needs a card on file even on the free tier |
| Vectorize dimensions wrong | Index exists but does not match the embedding model (`openai/text-embedding-3-small` → 1536 dims) | Dimensions are immutable — delete and recreate: `bunx wrangler vectorize delete apollo-memory && bunx wrangler vectorize create apollo-memory --dimensions=1536 --metric=cosine`. This erases stored embeddings (see Memory maintenance below) |
| Queue missing | `apollo-jobs` not created | `bunx wrangler queues create apollo-jobs` |
| Secret unset | A required secret was never put | `bunx wrangler secret put <NAME>` or re-run `bun run bootstrap secrets` |
| Voice id placeholder empty | `APOLLO_TTS_VOICE` in `src/configuration/identity.ts` still blank | Paste your ElevenLabs voice id, redeploy — or run with `MOCK_VOICE=1` while you don't have one |
| 401 on the probe | Token mismatch | The probe token must equal the deployed `DEVICE_SHARED_SECRET` byte-for-byte; re-run `bun run bootstrap secrets` and probe again |

Manual probe, any time:

```sh
bun run probe -- --url wss://<host>/agents/apollo/desk --token <secret> [--text "hola"]
```

## Logs

```sh
bunx wrangler tail apollo            # live tail, pretty
bunx wrangler tail apollo --format json
```

Every log line the worker emits is `console.log`/`console.error` of a single `JSON.stringify({ level, message, ...fields })` object — filter on the `message` field. Useful ones: `firmware_push_attempted`, `firmware_push_result`, `firmware_push_skipped` (carries a `reason`), `firmware_push_missing_origin`, `firmware_changelog_pending`, `apollo_device_message_invalid`, `owner_memory_extraction_invalid`.

Observability is already on in `wrangler.jsonc` (`"observability": { "enabled": true, "head_sampling_rate": 1 }`), so every invocation also lands in the Cloudflare dashboard's Workers Logs — no config needed for historical queries.

## OTA publishing runbook

The device self-updates from the `MEDIA` R2 bucket. Reference firmware: https://github.com/galfrevn/apollo-firmware. Layout:

- `firmware/latest.json` — the manifest, parsed by `src/ota/manifest.ts`: `{ "version": "2.5.0", "key": "firmware/apollo-2.5.0.bin" }` plus an optional `"changelog"` (1–500 chars, spoken verbatim by Apollo after the update)
- `firmware/apollo-<version>.bin` — the app image

Rules that keep devices alive:

1. **Upload the app image, never a merged/full flash binary.** The merged binary contains the bootloader and partition table and would corrupt an OTA slot.
2. **`version` must match `/^\d+(\.\d+)*$/`** — digits and dots only. The worker refuses anything else because the device's version parser runs `std::stoi` per segment with no try/catch and aborts on non-numeric input. Comparison is numeric per dot-segment; on a tie prefix the longer version wins (`"2.6.0" > "2.6"`, `src/ota/push.ts`).
3. **Binary before manifest**, so a check never resolves a manifest whose binary is not there yet:

```sh
bunx wrangler r2 object put apollo-media/firmware/apollo-2.5.0.bin \
  --file build/app.bin --content-type application/octet-stream --remote
bunx wrangler r2 object put apollo-media/firmware/latest.json \
  --file latest.json --content-type application/json --remote
```

A malformed manifest degrades to "no update available", never to a parse error on the device.

**Serving** (`src/ota/routes.ts`): the device checks `/ota/check?token=...` and gets `{ firmware: { version, url, force: 0 } }` where `url` points at `/ota/firmware.bin` with the token in the query. The binary route always sends `Content-Length` — the reference downloader aborts without it. Smoke-test after publishing:

```sh
curl -s "https://<host>/ota/check?token=$DEVICE_SHARED_SECRET"        # new version
curl -sI "https://<host>/ota/firmware.bin?token=$DEVICE_SHARED_SECRET" # 200 + exact Content-Length
```

**Server-initiated push** (`src/ota/push.ts`, `src/ota/lifecycle.ts`): every telemetry tick is a chance to push. The manifest is re-checked at most every 15 minutes (`FIRMWARE_PUSH_CHECK_INTERVAL_MS`), immediately on a charging edge. The push calls the device tool `self.upgrade_firmware` over the MCP bridge only when ALL hold:

- device reported a version, and it is older than the manifest
- UI state is `idle` or `dashboard`; no focus session, no pending confirmation, no announcement in flight
- charging, or battery ≥ 50% (`FIRMWARE_PUSH_MINIMUM_BATTERY_PERCENT`)
- fewer than 3 attempts for this manifest version (`FIRMWARE_PUSH_MAX_ATTEMPTS_PER_VERSION`), spaced 6 h apart (`FIRMWARE_PUSH_RETRY_COOLDOWN_MS`) — a device that rolls back stops being retried until the next release

Skips are logged as `firmware_push_skipped` with the reason (`insufficient_power`, `attempt_limit`, `retry_cooldown`, `unsafe_ui_state`, …). The binary URL is built from the origin captured when the device last connected; `firmware_push_missing_origin` means no device has connected to this deployment yet.

**Kill switch**: set the var `FIRMWARE_PUSH_DISABLED=1` and redeploy — pushes stop, but boot-time checks via `/ota/check` still serve the manifest, and the post-update changelog announcement still runs.

After the reboot, the first telemetry reports the new version and Apollo announces it: "Me actualicé al firmware 2.5.0: …" using the manifest `changelog`, or "Me actualicé al firmware 2.5.0 mientras no me usabas." without one.

## Device connection lifecycle

On device connect (`onConnect` in `src/agents/apollo.ts`): the server stores the connection's origin (for OTA URLs), clears any stale caption, pushes `ui_state` and the dashboard, then **flushes and consumes** the `pending_device_messages` queue — reminders and background results queued while the device was offline arrive as silent cards; queued broadcasts deliver with sound. This flush is device-only by design: a browser taking that path would swallow messages the device can never speak.

Reconnects are normal and driven by the firmware — expect a gap of up to a couple of minutes after a WiFi drop before the device reappears.

Telemetry cadence: the device sends `telemetry` right after the channel opens, then every 60 seconds, and immediately on a charging edge. A device that connects then goes silent is diagnosed by that cadence — if no telemetry lands within ~60 s of the hello, the socket is half-dead on the device side. The server treats a snapshot as fresh for 5 minutes; after that, battery/charging stops appearing in the prompt and push evaluation works from stale data.

## Costs and ceilings

Everything shipped runs on the Cloudflare free plan (as of Aug 2026), except the coding opt-in:

| Resource | Free plan | Symptom when the ceiling hits |
|---|---|---|
| Durable Objects (SQLite) | Included | — |
| R2 (`apollo-media`) | Included, card on file required | TTS cache / OTA / media writes fail |
| Vectorize (`apollo-memory`) | Included | Memory recall / store errors |
| Queues (`apollo-jobs`) | 10k ops/day, 24 h retention | Enqueues throw → reminders and background jobs stop landing |
| Workflows | 3,000 steps/day | Deep research / coding workflows fail mid-run |
| Containers (coding opt-in) | **Workers Paid only** | `coding` absent from `/health` features |

Daily free limits **hard-fail until the 00:00 UTC reset** — an Apollo that errors on background work all evening and heals overnight hit a daily ceiling, not a bug.

WebSocket billing on the Durable Object: incoming messages count as requests at a 20:1 ratio (20 messages = 1 request), outgoing messages are free, and the Hibernation API stops duration billing while an accepted socket idles — a connected-but-quiet desk costs approximately nothing.

External spend:
- **ElevenLabs**: `eleven_multilingual_v2` burns roughly one credit per character, so a typical two-sentence spoken reply is on the order of 100–300 credits — a 10k-credit free tier is only a few dozen replies. Earcons (`play_effect`) are burned into device flash and cost zero credits. `MOCK_VOICE=1` is the zero-cost mode: it skips real STT/TTS, vector recall, and the nightly consolidation LLM call.
- **OpenRouter**: pure pay-per-use per token (conversation, STT, embeddings, research). No ceiling; watch the balance.

## Upgrading from upstream

Your copy is a **generated snapshot** (degit/template), not a fork — there is no shared git history to merge. Upstream releases are tagged snapshots of the same repo.

1. Note which tag you started from (record it at bootstrap time if you haven't).
2. Fetch the new tagged snapshot into a sibling directory.
3. Diff and merge: either `git diff --no-index <your-copy> <new-snapshot>` and cherry-pick hunks, or generate the patch *between the two upstream tags* and `git apply --3way` it onto your copy so your local edits survive as conflicts instead of overwrites.
4. Local edits to `src/` are **yours to carry** — upstream will never know about them; expect conflicts in files you changed and resolve them by hand.
5. Always finish with `bun run check` (types, typecheck, test) and `bun run bootstrap verify` against the redeployed worker.

## Memory maintenance

Where data lives: everything conversational is on the `Apollo` Durable Object's SQLite (`memories`, `session_prefs`, `pending_device_messages`, `list_items` — created in `onStart`), plus embeddings in the Vectorize index `apollo-memory`, namespaced by device id (`src/memory/vector.ts`).

Nightly consolidation (`src/memory/consolidate.ts`, cron `'0 6 * * *'` UTC registered on the DO scheduler): reads a 48 KB tail of the transcript, asks the conversation model to extract/reinforce/retire owner facts, merges (dedupe by content, 60-day decay for unconfirmed facts, capped at 50 evicting the weakest), and rewrites the `memory` context block. The `memories` table and Vectorize stay append-only as the provenance log `recall_memory` searches — decayed facts are not deleted from them. An idle day (unchanged transcript leaf) skips the LLM call; `MOCK_VOICE=1` skips the run entirely. State lives in `session_prefs` under `ownerMemoryState`; failures log `owner_memory_extraction_invalid` and retry the same window the next night.

**Data loss warnings**: deleting the Durable Object instance destroys all memories, threads, lists, preferences, and pending messages; deleting or recreating the Vectorize index destroys semantic recall (SQL keyword recall survives). Neither is recoverable — there is no backup layer. Treat the dims-mismatch recreate above as the one sanctioned reason to drop the index, and do it before real memories accumulate.
