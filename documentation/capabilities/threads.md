# Threads

Conversations with Apollo are grouped into **threads**: bounded sessions that start when the owner speaks after a silence and close after inactivity. Threads are what the console lists under History, what nightly memory consolidation walks, and what `recall_conversation` searches.

## Why threads exist

The desk used to run one endless session (`desk-main`), which made the history read as a single blob and gave the agent no notion of "that conversation from yesterday". Cloudflare's Agents SDK recommends `SessionManager` — one session per conversation — for agents that handle many conversations, and that is what Apollo uses now (`apps/agent/src/memory/session.ts`).

## Lifecycle

1. **A turn arrives.** `#rotateThreadForTurn` (`apps/agent/src/agents/apollo.ts`) compares the time since the last turn against the cutoff (`THREAD_INACTIVITY_CUTOFF_MILLISECONDS`, 30 minutes, in `apps/agent/src/threads/lifecycle.ts`).
2. **Inside the window** the active thread session is reused; the turn appends to it as before.
3. **Past the window** a new session is created through `SessionManager.create` and the previous thread is scheduled for finalization. If the desk simply goes quiet, a scheduled idle check (`maybeFinalizeIdleThread`) finalizes the active thread without waiting for the next turn.
4. **Finalization** (`apps/agent/src/threads/finalize.ts`) classifies the thread:
   - **command** — at most `COMMAND_THREAD_MAX_USER_TURNS` spoken user turns (a timer, a weather check). Titled from the first utterance; no LLM call.
   - **conversation** — anything longer. One LLM call produces a Spanish title and a 2–4 sentence summary; if the reply does not parse, the first utterance becomes the title and the summary stays empty.

Classification is by spoken turn count; the tool calls a turn ran are recorded as `tool-call` parts on the assistant message (`apps/agent/src/agents/runtime.ts`) and shown as chips in the console, but do not influence classification yet.

## Continuity across the cutoff

A new thread does not start cold. When rotation opens one, the tail of the previous thread's transcript (`buildThreadHandoffNote`, `apps/agent/src/threads/handoff.ts`) is written into a per-session `handoff` context block, so "como te decía hace un rato…" still lands. The idle check leaves the closed thread's id in a preference precisely so the next turn — however much later — can pick up that tail.

## What is shared across threads, and what is not

- **Owner facts are shared.** The memory context block is pinned to the pre-thread storage key (`SHARED_MEMORY_CONTEXT_KEY = 'memory_desk-main'`) via an explicit `AgentContextProvider`. Without that pin the SDK would namespace the block per session and learned facts would fragment silently — do not remove the explicit provider.
- **Recency context is per thread.** The 8 KB history window a turn feeds to the LLM comes from the active thread only. A new thread starts contextually fresh; older material comes back through recall.
- **Nightly consolidation spans threads.** `runOwnerMemoryConsolidation` receives `gatherTranscriptSince`, which stitches transcripts from every thread active since the last run (`thread_meta.last_turn_at`), so facts said in a thread that closed at noon still reach the memory block.

## Recall and resume

Two voice tools work across threads (`apps/agent/src/tools/history.ts`):

- `recall_conversation` searches the full-text index across **all** thread sessions through `SessionManager.search` and quotes matching moments. It complements `recall_memory`, which searches distilled facts rather than raw turns.
- `resume_conversation` finds a past thread and **makes it the active thread again**. Finalized conversation summaries are indexed in Vectorize under `thread-<sessionId>` ids, so the lookup is semantic; a keyword match over titles and summaries (`apps/agent/src/threads/resume.ts`) covers mock mode and Vectorize outages. Reopening resets the thread's meta to pending so its next close regenerates title and summary. The turn that triggered the resume still lands in the thread it started in — the reopened context feeds the *next* turn, and the tool returns the stored summary so the agent can answer immediately.

## Growth limits

- **Retention**: command threads older than 30 days are purged daily (`purgeExpiredCommandThreads`), deleting both the SDK session and its meta row. Conversations are kept.
- **Compaction**: sessions auto-compact past a token threshold (`compactThreadMessageList`, `apps/agent/src/memory/session.ts`) — everything but the recent tail folds into a summary overlay. Originals stay in SQLite, so the console still shows full turns.

## Storage

The SDK owns `assistant_sessions` (registry: id, name, source, timestamps) and `assistant_messages`/`assistant_fts` (turns, indexed). Apollo adds one table, `thread_meta` (`apps/agent/src/threads/store.ts`): classification, summary, and last-turn timestamp per thread — deliberately outside the SDK's schema.

The active thread id and last-turn timestamp persist in `session_prefs`, so rotation survives Durable Object hibernation.

## Console surface

`listConsoleThreads` returns the merged catalog (SDK registry + `thread_meta`); `getConsoleThread` returns one thread's turns with timestamps (messages now carry `createdAt`). The History page shows **Conversations** and **Commands** as separate views, with the active thread pinned first.

## Migration

The legacy `desk-main` session is frozen: it is never written again, appears in the console as "Historial previo a los hilos", and its turns stay searchable through recall. Its messages predate `createdAt` stamping and tool-call recording, so they render without timestamps or tool chips.

## Navigation

Prev: [Memory](memory.md) · Next: [Research](research.md)
