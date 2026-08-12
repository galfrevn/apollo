# Tools

Tools are how Apollo takes action beyond talking. Definitions live under `apps/agent/src/tools/`; the built-in list is assembled in `apps/agent/src/tools/catalog.ts`.

## Built-in catalog

- Weather: `weather_now`, `set_weather_location`
- Memory: `remember_fact`, `recall_memory`
- Focus: `set_focus`, `clear_focus`
- Search / research: `web_search`, `start_research`
- Language: `translate`
- Reminders: `set_reminder`, `list_reminders`, `cancel_reminder`
- Timers: `set_timer`, `start_pomodoro` (ride the reminder scheduler; pomodoro also activates focus; `cancel_reminder` cancels timers too)
- Lists: `add_to_list`, `read_list`, `remove_from_list` (SQL table `list_items`; default list "super")
- Finance: `dollar_rate` (dolarapi.com, free/keyless: blue, oficial, bolsa, contadoconliqui, tarjeta, cripto)
- Email: `send_email` (Resend, secret `RESEND_API_KEY`; recipient pinned to `APOLLO_OWNER_EMAIL` var — deep-research reports are also emailed automatically)
- Sandbox: `sandbox_run_code`, `sandbox_exec` (both marked `unsafe`, so they route through confirmation)
- Coding: `start_coding_task` (`unsafe`; clones a repo, edits it, opens a PR — see [Coding](coding.md))

The catalog is the compiled-in half. Tools the owner connects at runtime, from external MCP
servers, are assembled into the same map on every turn — see [MCP servers](mcp.md).

## Router

The router resolves tool names to definitions, validates inputs, and coordinates confirmation when a tool is marked as needing it. Prefer extending the catalog with a new definition over special-casing in the agent class.

## Confirmations

A tool asks for confirmation when — and only when — its definition is `safety: 'unsafe'`
(`apps/agent/src/tools/router.ts`). The router then returns `needs_confirm` instead of running the
handler, the agent emits `confirm_request`, and the side effect waits for the device's
`confirm` (or the 30 s expiry). On firmware with the confirm screen, that message
replaces the face with the summary plus Sí/No touch buttons. However the window ends —
button, dashboard RPC, expiry, orphan cleanup — the agent broadcasts `confirm_close`
so the device never sits on a stale prompt.

The unsafe tools in the shipped catalog are the sandbox pair and `start_coding_task`,
so the confirmation path — protocol messages, UI `confirm` state, `questioning` face —
is exercised in production. Anything genuinely destructive or outward-facing added later
should be `unsafe` with a `buildConfirmSummary`; the plumbing is already in use.

Tools that look risky but are `safe` earn it structurally rather than by review:
`send_email` cannot choose a recipient, `set_weather_location` only persists after an
explicit ask, and `remove_from_list` needs either an item match or an explicit
`clearAll`.

## Product fit

On a desk device, tools should be obvious in speech (“reminder set for six”) and safe when destructive or sticky (confirmations, explicit location saves).

## Navigation

Prev: [Face](../runtime/face.md) · Next: [Memory](memory.md)
