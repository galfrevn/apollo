# Memory

Apollo keeps both conversational session memory and longer-lived facts.

## Layers

| Layer | Role | Code |
|-------|------|------|
| Session | Agent conversation memory | `src/memory/session.ts` |
| Store | SQL preferences / structured rows on the DO | `src/memory/store.ts` |
| Vector | Embeddings for recall | `src/memory/vector.ts` |
| Pending | Messages waiting for the device | `src/memory/pending.ts` |

## Tools

- `remember_fact` stores something worth recalling later
- `recall_memory` searches memory instead of guessing

## Preferences

Small durable preferences (for example default weather location) go through the store, not the vector index.

## Navigation

Prev: [Tools](tools.md) · Next: [Research](research.md)
