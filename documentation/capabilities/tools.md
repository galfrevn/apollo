# Tools

Tools are how Apollo takes action beyond talking. Definitions live under `src/tools/`; the built-in list is assembled in `src/tools/catalog.ts`.

## Built-in catalog

- Weather: `weather_now`, `set_weather_location`
- Memory: `remember_fact`, `recall_memory`
- Focus: `set_focus`, `clear_focus`
- Search / research: `web_search`, `start_research`
- Language: `translate`
- Reminders: `set_reminder`, `list_reminders`, `cancel_reminder`
- Sandbox: `sandbox_run_code`, `sandbox_exec`

## Router

The router resolves tool names to definitions, validates inputs, and coordinates confirmation when a tool is marked as needing it. Prefer extending the catalog with a new definition over special-casing in the agent class.

## Product fit

On a desk device, tools should be obvious in speech (“reminder set for six”) and safe when destructive or sticky (confirmations, explicit location saves).

## Navigation

Prev: [Persona](../runtime/persona.md) · Next: [Memory](memory.md)
