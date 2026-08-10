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
| Face (emotion, accent color) | `src/persona/face.ts` |
| Tools | `src/tools/` |
| Memory | `src/memory/` |
| Search / research pipeline | `src/search/`, `src/tools/research.ts`, `src/tools/web.ts` |
| Weather | `src/weather/`, `src/agents/dashboard.ts` |
| Focus | `src/focus/`, `src/tools/focus.ts` |
| Reminders | `src/reminders/`, `src/tools/reminder.ts` |
| Timers / pomodoro | `src/tools/timer.ts` (rides `src/reminders/`) |
| Lists | `src/lists/`, `src/tools/list.ts` |
| Dollar rates | `src/rates/`, `src/tools/dollar.ts` |
| Email | `src/notifications/`, `src/tools/email.ts` |
| Sandbox | `src/sandbox/`, `src/tools/sandbox.ts` |
| Auth | `src/auth/` |
| Queues | `src/queues/` |
| Workflows | `src/workflows/` |
| Media | `src/media/` |
| Session UI machine | `src/session/` |
| Config / env types | `src/configuration/`, `wrangler.jsonc` |
| Firmware (separate repo) | `firmware/apollo-firmware` (git submodule, own handbook) |

## Navigation

Prev: [Testing](../operations/testing.md) · Next: [Roadmap](roadmap.md)
