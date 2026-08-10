# Tools

Tools are how Apollo takes action beyond talking. Definitions live under `src/tools/`; the built-in list is assembled in `src/tools/catalog.ts`.

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

## Router

The router resolves tool names to definitions, validates inputs, and coordinates confirmation when a tool is marked as needing it. Prefer extending the catalog with a new definition over special-casing in the agent class.

## Product fit

On a desk device, tools should be obvious in speech (“reminder set for six”) and safe when destructive or sticky (confirmations, explicit location saves).

## Navigation

Prev: [Face](../runtime/face.md) · Next: [Memory](memory.md)
