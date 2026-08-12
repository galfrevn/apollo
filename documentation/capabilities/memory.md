# Memory

Apollo keeps both conversational session memory and longer-lived facts.

## Layers

| Layer | Role | Code |
|-------|------|------|
| Session | Agent conversation memory | `apps/agent/src/memory/session.ts` |
| Store | SQL preferences / structured rows on the DO | `apps/agent/src/memory/store.ts` |
| Vector | Embeddings for recall | `apps/agent/src/memory/vector.ts` |
| Pending | Messages waiting for the device | `apps/agent/src/memory/pending.ts` |

## What a turn records

Both layers key off the **transcript**, not the raw input: a hold-to-talk turn arrives as audio and only becomes text after STT runs inside `apps/agent/src/turn/run.ts`, which returns it as `TurnOutput.transcript`. `apps/agent/src/agents/runtime.ts` appends that transcript (and the reply) to the session, and runs semantic recall with it. Gating either on the caller's `text` instead would skip every spoken turn.

Each turn also reads a small recency window back out: `buildRecentTurnHistoryMessageList` (`apps/agent/src/memory/session.ts`) calls `session.getRecentHistory` with an 8 KB budget and a 10-message floor, and `apps/agent/src/turn/run.ts` splices those prior user/assistant turns into the LLM message list ahead of the current utterance. This is what lets a follow-up said moments after a reply — including one after a fresh wake-word activation — reference what was just discussed; a new wake word does not reset the session or its history.

## Tools

- `remember_fact` stores something worth recalling later
- `recall_memory` searches memory instead of guessing

Vector recall is skipped entirely when `MOCK_VOICE=1`, so local runs never spend
embedding calls; keyword recall from the SQL store still works.

## Tables on the Durable Object

`memories`, `session_prefs`, `pending_device_messages`, and `list_items` (see
[Lists](lists.md)) are created in `onStart` (`apps/agent/src/agents/apollo.ts`).

## Consolidación nocturna (owner memory)

A cron on the DO scheduler (`'0 6 * * *'` UTC = 03:00 Buenos Aires, registered in
`onStart`) runs `consolidateOwnerMemory`: it reads a byte-budgeted tail of the
transcript (`session.getRecentHistory`, 48 KB), asks the conversation model to
extract, reinforce, and retire facts about the owner (`apps/agent/src/memory/consolidate.ts`,
strict-JSON with one corrective retry), merges them (dedupe by content, 60-day decay
for unconfirmed facts, capped at 50 evicting the weakest first), and **rewrites** the
`memory` context block — which until this feature only ever grew by appends from
`remember_fact`.

Ownership split: the consolidated block governs what occupies prompt budget; the
`memories` table + Vectorize stay append-only as the provenance log `recall_memory`
searches — decayed facts are not deleted from them. Genuinely new facts flow into
both. State (fact list, last run, last processed leaf) lives in `session_prefs`
under `ownerMemoryState`; an idle day (unchanged leaf) skips the LLM call, and
`MOCK_VOICE=1` skips the run entirely.

"¿Qué aprendiste de mí?" needs no tool: the block sits in the system prompt and the
persona instructs Apollo to answer from it in first person (`apps/agent/src/persona/soul.ts`).

## Preferences

Small durable preferences (default weather location, speech mode) go through the store, not the vector index.

## Navigation

Prev: [Tools](tools.md) · Next: [Research](research.md)
