# Portability

How Apollo stops being tied to one provider. Cloudflare remains the reference host — the one deploys target, the one the starter provisions — but the agent's architecture is converging on explicit platform ports so that a persistent Node/Bun process in Docker on a VPS becomes a first-class second home. This chapter records the strategy, the port catalog, and the phased plan.

## Why, and why Docker first

Being tied to a single provider is a product risk for a personal agent people self-host: an account limit, a pricing change, or a regional gap becomes the owner's problem. The first alternative target is a **persistent process in a container** — a VPS, Fly.io, Railway, a homelab — because it is the only host shape that naturally supports what a voice turn actually is: a WebSocket held open for tens of seconds carrying bidirectional PCM, paced by timers, with an in-memory audio buffer and a barge-in flag. Serverless platforms (Vercel functions included) cannot hold that connection; the console SPA, in contrast, is already static and runs anywhere.

## Where the coupling lives

The agent is deeply Cloudflare-coupled, but the coupling is concentrated. Of ~180 files in `apps/agent/src`, nearly all platform knowledge sits in:

| File | Coupling |
|------|----------|
| `src/agents/apollo.ts` | `Agent` base class (Durable Object): state sync, `@callable` RPC, connection tags, schedules, `this.mcp`, SQLite DDL |
| `src/index.ts` | `routeAgentRequest`, queue handler, adapter construction |
| `src/memory/session.ts` | `agents/experimental/memory/session` session manager |
| `src/workflows/*.ts` | `WorkflowEntrypoint` from `cloudflare:workers`, `getAgentByName` |
| `src/platform/cloudflare/*` | Every binding adapter, deliberately |

Everything else is platform-neutral TypeScript with injected dependencies — which is why the whole test suite runs under plain `bun test` with no workerd.

What each Cloudflare primitive actually provides, versus what Apollo uses:

| Primitive | What Apollo actually relies on |
|-----------|-------------------------------|
| Durable Object | One single-threaded actor per device; embedded synchronous SQLite; alarms |
| WebSocket hibernation | Cheap idle connections; forced the durable tables (`pending_confirmations`, telemetry snapshots) that now double as crash-safety |
| Workflows | Per-step durable memoization keyed by `(instanceId, step name)`; retry policies |
| Queues | `send`, `ack`, `retry` — nothing else |
| R2 | `get`/`put`/`delete`/`list` — an S3-compatible subset |
| Vectorize | Namespaced upsert/query/delete, ~40 lines of surface |

## The port catalog

Ports live in `src/platform/`, one file per concern; Cloudflare adapters live in `src/platform/cloudflare/`. A port's shape is derived from actual usage, never from the provider's full API.

| Port | File | Cloudflare adapter | Replaces |
|------|------|--------------------|----------|
| `MemorySqlExecutor` | `src/memory/store.ts` | `platform/cloudflare/sql.ts` | `ctx.storage.sql` (synchronous on purpose — both target drivers, `bun:sqlite` and better-sqlite3, are synchronous; making it async would poison ~20 store modules for no host that needs it) |
| `BlobStore` | `platform/blob.ts` | `platform/cloudflare/blob.ts` | R2 (`MEDIA`) |
| `VectorStore` | `platform/vector.ts` | `platform/cloudflare/vector.ts` | Vectorize |
| `JobPublisher` | `platform/jobs.ts` | `platform/cloudflare/jobs.ts` | Queue producer |
| `RunLauncher` | `platform/runs.ts` | `platform/cloudflare/runs.ts` | Workflow `create()` |
| `StepRunner` | `platform/steps.ts` | `platform/cloudflare/steps.ts` | `step.do` durable memoization |

Pre-existing seams now recognized as ports: `DeskToolEffects` (`src/tools/types.ts` — tools never touch the host), `VoiceAdapters` (`src/turn/run.ts` — STT/LLM/TTS, mockable wholesale), and `SandboxLike`/`CodingSandboxPort` (`src/coding/run.ts` — the sandbox is already optional and structural).

The workflow bodies themselves are extracted to `src/runs/` (`background.ts`, `coding.ts`): pure functions over `StepRunner` plus injected dependencies. `src/workflows/` keeps only the Cloudflare shells that bind `this.env` and `getAgentByName` into closures. **Step names are memoization keys**: `src/runs/__tests__/` pins the exact sequences, because renaming a step invalidates every in-flight instance on any host.

Two deliberate exceptions in Phase 1: `R2SkillProvider` in `src/memory/session.ts` still receives `environment.MEDIA` directly (it is SDK-consumed and wants `customMetadata` in listings, which S3 cannot serve without per-object HEADs — Phase 2 wraps the blob port in an R2Bucket-shaped shim instead of contaminating the port), and `Env` remains the configuration carrier for keys and model ids (Phase 2 replaces it with a zod-validated configuration type).

## Phase 2 — the Node host (design)

A single persistent Bun/Node process per deployment, hosting the same portable core.

**Console framing.** The console must keep working unchanged, which pins the wire contract of `useAgent` (verified against `agents@0.20.1` `dist/client.js`): the client connects to `GET /agents/apollo/<name>?token=…` and expects, on connect, `{"type":"cf_agent_identity","name":…,"agent":"apollo"}` — mandatory; the client's `ready` promise resolves only on it — then `{"type":"cf_agent_state","state":…}` (re-broadcast on every state change) and optionally `cf_agent_mcp_servers`. RPC is `{"type":"rpc","id","method","args"}` answered by `{"type":"rpc","id","success",result|error}`. Close codes `1008` and `4000-4999` are terminal (no client reconnect) — reject bad tokens with `1008`. Reconnection and timeouts are client-side. The 34 `@callable` bodies become plain functions dispatched by method name; this is safe because every method already re-validates the dashboard secret inside its payload — the DO never trusted the connection identity.

**Session manager.** `agents/experimental/memory/session` runs outside a Durable Object: its only host dependency is `SqlProvider { sql<T>(strings, ...values): T[] }` — a synchronous tagged template (verified: 52 uses of `agent.sql`, zero of storage/ctx/alarms, no `cloudflare:*` imports). A ~10-line wrapper over `bun:sqlite` satisfies it. Requirements: SQLite built with FTS5 (both `bun:sqlite` and better-sqlite3 ship it), one database file per device identity, and the `agents` package pinned exactly — the namespace is experimental, so every bump re-verifies the `SqlProvider` surface. Vendoring is the fallback, expected unnecessary.

**Scheduler.** A `schedules` table (id, method name, payload, at/cron) plus `setTimeout` wake and a catch-up sweep on boot. It must reproduce the SDK's `Schedule` record shape because the reminder list is literally `listSchedules()` filtered.

**Storage defaults.** Blob: filesystem directory (metadata sidecar files carry what the skills prefix needs), S3/MinIO adapter optional. Vector: brute-force cosine over a SQLite embeddings table — a personal agent holds thousands of memories, not millions; `sqlite-vec` is a later optimization and pgvector only enters if Postgres ever does. Jobs: a SQLite queue table with an in-process poller reusing `executeApolloQueueJob` verbatim.

**Workflows.** A hand-rolled step runner behind the existing `StepRunner` port: a `workflow_steps (instance_id, step_name, result_json, completed_at)` checkpoint table; crash recovery re-invokes the run functions for incomplete instances on boot, and completed steps replay from checkpoints — exactly the Cloudflare memoization contract Phase 1 froze. Temporal was rejected (an entire server fleet for two workflows on a single-tenant box) and BullMQ too (a Redis dependency that still would not provide step memoization). A 45-minute coding run is unremarkable inside a persistent process.

**The single-actor rule.** The in-memory state that makes a device correct — the audio chunk buffer, the barge-in flag, the device MCP request registry — is only safe because exactly one instance serves a device. The Node host keeps the rule: one process (or one in-process actor) per device, no replicas. The hibernation-era durable tables stay as belt-and-braces.

**Open spike.** Whether `MCPClientManager` (`agents/mcp`, including the OAuth callback flow) constructs outside a Durable Object is unverified — it is the first Phase 2 investigation. Fallback: implement the console's MCP RPC surface directly over `@modelcontextprotocol/sdk`.

## Phase 3 — packaging (design)

A Bun-based Dockerfile plus a compose file: the agent process, a volume for the SQLite databases and the blob directory, optionally MinIO. The coding sandbox maps to a Docker-sibling adapter behind `CodingSandboxPort`, or stays absent — the degraded-mode guards in `src/sandbox/capability.ts` already cover that. The wizard grows a non-wrangler provisioning path (generate compose + `.env` instead of `wrangler` calls); that work is scoped to its own pass, with the parity machinery described in [Starter](starter.md).

## Phases and exit criteria

| Phase | Scope | Exit criteria |
|-------|-------|---------------|
| 1 (done) | Ports + Cloudflare adapters in-repo | Zero behavior change; `bun run check` green; step-name sequences pinned by specs |
| 2 (walking skeleton done) | Bun host: WS server (device protocol + console framing), scheduler, SQLite/blob/vector/jobs adapters, step runner | A device and the unchanged console complete a full session against the Bun host; workflows resume across a process restart |
| 3 | Dockerfile + compose; wizard target selection | `docker compose up` yields a working agent; `create-heyapollo` can scaffold for either target |

### Phase 2 status

`bun run host` (in `apps/agent`) boots the Bun host: `src/host/` wires the
adapters into a per-device actor, a `Bun.serve` websocket server that speaks
both framings, a console RPC registry, and a run engine that resumes pending
workflow instances from step checkpoints on boot. Verified end to end: a mock
voice turn over the device protocol, and the unchanged console connected to the
host — identity, state sync, RPC, live telemetry — plus terminal `1008` closes
on bad tokens. Both spikes from the design above are resolved and pinned by
specs: the SDK session manager runs on `bun:sqlite` (FTS5 included), and
`MCPClientManager` constructs against a structural storage shim.

Still on the phase 2 list: thread rotation and finalization on the host (turns
run on the active-or-legacy session; no rotation yet), the device MCP bridge
and installed MCP servers (tools degrade with an explicit message), the
initiative/firmware/OTA-push lifecycles, broadcast audio upload, gesture
handling, and the remaining console RPCs (MCP quintet, device volume /
brightness / status, audio upload trio) — the registry answers those with a
clear "not on this host yet" error the console surfaces per page.

## Navigation

Prev: [Starter](starter.md)
