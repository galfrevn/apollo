# Mapping

Thin map from handbook topics to code folders. Prefer the narrative chapters for behavior; use this table to jump into the repo.

| Topic | Primary `src/` paths |
|-------|----------------------|
| Worker entry / health | `src/index.ts` |
| Agent / desk DO | `src/agents/` |
| Turn execution | `src/turn/`, `src/agents/runtime.ts` |
| Protocol | `src/protocol/` |
| Voice (STT/LLM/TTS) | `src/voice/` |
| Persona / speech modes | `src/persona/` |
| Tools | `src/tools/` |
| Memory | `src/memory/` |
| Search / research pipeline | `src/search/`, `src/tools/research.ts`, `src/tools/web.ts` |
| Weather | `src/weather/`, `src/agents/dashboard.ts` |
| Focus | `src/focus/`, `src/tools/focus.ts` |
| Reminders | `src/reminders/`, `src/tools/reminder.ts` |
| Sandbox | `src/sandbox/`, `src/tools/sandbox.ts` |
| Auth | `src/auth/` |
| Queues | `src/queues/` |
| Workflows | `src/workflows/` |
| Media | `src/media/` |
| Session UI machine | `src/session/` |
| Config / env types | `src/configuration/`, `wrangler.jsonc` |

## Navigation

Prev: [Testing](../operations/testing.md)
