# Mapping

Thin map from handbook topics to code folders. Prefer the narrative chapters for behavior; use this table to jump into the repo.

| Topic | Primary `apps/agent/src/` paths |
|-------|----------------------|
| Worker entry / health | `apps/agent/src/index.ts` |
| Agent / desk DO | `apps/agent/src/agents/` |
| Turn execution | `apps/agent/src/turn/`, `apps/agent/src/agents/runtime.ts` |
| Protocol | `apps/agent/src/protocol/` |
| Voice (STT/LLM/TTS) | `apps/agent/src/voice/` |
| Persona / speech modes | `apps/agent/src/persona/` |
| Face (emotion, accent color) | `apps/agent/src/persona/face.ts` |
| Tools | `apps/agent/src/tools/` |
| Memory | `apps/agent/src/memory/` |
| Threads | `apps/agent/src/threads/`, `apps/agent/src/tools/history.ts`, `apps/agent/src/console/history.ts` |
| Search / research pipeline | `apps/agent/src/search/`, `apps/agent/src/tools/research.ts`, `apps/agent/src/tools/web.ts` |
| Weather | `apps/agent/src/weather/`, `apps/agent/src/agents/dashboard.ts` |
| Focus | `apps/agent/src/focus/`, `apps/agent/src/tools/focus.ts` |
| Reminders | `apps/agent/src/reminders/`, `apps/agent/src/tools/reminder.ts` |
| Timers / pomodoro | `apps/agent/src/tools/timer.ts` (rides `apps/agent/src/reminders/`) |
| Broadcast | `apps/agent/src/broadcast/`, `apps/console/src/broadcast/` |
| Lists | `apps/agent/src/lists/`, `apps/agent/src/tools/list.ts` |
| Dollar rates | `apps/agent/src/rates/`, `apps/agent/src/tools/dollar.ts` |
| Email | `apps/agent/src/notifications/`, `apps/agent/src/tools/email.ts` |
| Sandbox | `apps/agent/src/sandbox/`, `apps/agent/src/tools/sandbox.ts` |
| Coding tasks | `apps/agent/src/coding/`, `apps/agent/src/github/`, `apps/agent/src/tools/coding.ts`, `apps/agent/src/workflows/coding.ts` |
| MCP servers (installed) | `apps/agent/src/mcp/adapter.ts`, `apps/agent/src/mcp/naming.ts`, `apps/agent/src/mcp/servers.ts`, `apps/agent/src/mcp/settings.ts` |
| MCP bridge (device) | `apps/agent/src/mcp/bridge.ts`, `apps/agent/src/tools/device.ts` |
| Auth / connection roles | `apps/agent/src/auth/` |
| Queues | `apps/agent/src/queues/` |
| Workflows | `apps/agent/src/workflows/` |
| Session UI machine | `apps/agent/src/session/` |
| Config / env types | `apps/agent/src/configuration/`, `apps/agent/wrangler.jsonc` |
| Firmware (separate repo) | `apps/firmware/apollo-firmware` (git submodule, own handbook) |
| Starter generator | `apps/wizard/generator/` (see [Starter](starter.md)) |
| Setup wizard | `apps/wizard/src/`, shipped into the starter as `setup/` |
| Starter skills | `documentation/skills/`, shipped as `.claude/skills/` |

## Navigation

Prev: [Landing](../console/landing.md) · Next: [Roadmap](roadmap.md)
