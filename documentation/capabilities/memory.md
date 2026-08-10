# Memory

Apollo keeps both conversational session memory and longer-lived facts.

## Layers

| Layer | Role | Code |
|-------|------|------|
| Session | Agent conversation memory | `src/memory/session.ts` |
| Store | SQL preferences / structured rows on the DO | `src/memory/store.ts` |
| Vector | Embeddings for recall | `src/memory/vector.ts` |
| Pending | Messages waiting for the device | `src/memory/pending.ts` |

## What a turn records

Both layers key off the **transcript**, not the raw input: a hold-to-talk turn arrives as audio and only becomes text after STT runs inside `src/turn/run.ts`, which returns it as `TurnOutput.transcript`. `src/agents/runtime.ts` appends that transcript (and the reply) to the session, and runs semantic recall with it. Gating either on the caller's `text` instead would skip every spoken turn.

## Tools

- `remember_fact` stores something worth recalling later
- `recall_memory` searches memory instead of guessing

Vector recall is skipped entirely when `MOCK_VOICE=1`, so local runs never spend
embedding calls; keyword recall from the SQL store still works.

## Tables on the Durable Object

`memories`, `session_prefs`, `pending_device_messages`, and `list_items` (see
[Lists](lists.md)) are created in `onStart` (`src/agents/apollo.ts`).

## Preferences

Small durable preferences (default weather location, speech mode) go through the store, not the vector index.

## Navigation

Prev: [Tools](tools.md) · Next: [Research](research.md)
