Everything Apollo can do beyond talking goes through one typed tool catalog. The model requests a tool by name, the router validates the arguments, and the result comes back as something Apollo can say. Extending the agent means extending this catalog — never special-casing the agent itself.

![Small instruments laid out in a strict grid on a dark workbench](/handbook/capabilities.jpg)

## The catalog

The built-in tools, grouped by concern:

| Concern | Tools |
| --- | --- |
| Weather | `weather_now`, `set_weather_location` |
| Memory | `remember_fact`, `recall_memory` |
| Conversations | `recall_conversation`, `resume_conversation` |
| Focus | `set_focus`, `clear_focus` |
| Search and research | `web_search`, `start_research` |
| Language | `translate` |
| Reminders | `set_reminder`, `list_reminders`, `cancel_reminder` |
| Timers | `set_timer`, `start_pomodoro` |
| Lists | `add_to_list`, `read_list`, `remove_from_list` |
| Finance | `dollar_rate` |
| Email | `send_email` |
| Device | `set_volume`, `set_brightness`, `device_status` |
| Sandbox | `sandbox_run_code`, `sandbox_exec` |
| Coding | `start_coding_task`, `list_coding_repositories` |

A few behave in ways the names do not show:

- **Timers ride the reminder scheduler.** A pomodoro also activates focus mode, and `cancel_reminder` cancels timers too.
- **Lists are durable.** They live in the desk's own SQLite, with a default list named "super".
- **The conversation pair reaches into the past.** Recall what was said, or resume a thread where it left off.
- **`dollar_rate`** quotes Argentine exchange rates from a keyless public API.
- **Search splits by latency.** `web_search` answers in one turn; `start_research` leaves the turn entirely and returns later as a background result, with the full report also emailed to you.
- **The device trio rides the MCP bridge** from [Protocol](/docs/protocol) into the firmware itself, so the agent can adjust the volume, dim the screen, or read the hardware status of the body it lives in.
- **Sandbox and coding are opt-in.** Clone a repository, make a change, run the tests, open a pull request — all by voice, once you provision the extra tier.

## Asking first

Every tool declares `safety: 'safe'` or `'unsafe'`, and that field is the only thing that triggers confirmation.

When the model requests an unsafe tool, the router returns the request instead of running it, the server sends `confirm_request`, and the device replaces the face with a summary plus Sí/No buttons. The side effect runs only on an approved `confirm` within 30 seconds. However the window ends — button, console, expiry — the device always receives `confirm_close`, so it never sits on a stale prompt.

In the shipped catalog, the unsafe tools are the sandbox pair and `start_coding_task`.

Tools that look risky but are `safe` earn it structurally, not by review:

- `send_email` cannot choose a recipient; it is pinned to your own address.
- `set_weather_location` only persists after an explicit ask.
- `remove_from_list` needs an item match or an explicit clear-all.

The doctrine: safety is built into the tool's shape, never delegated to prompt instructions.

## Extending with MCP

The catalog is the compiled-in half. The other door is the Model Context Protocol: from the console you connect an external MCP server at runtime — no deploy, no flash — and its tools merge into the same map on every turn.

Installed tools are strictly opt-in. A newly connected server contributes nothing until you enable its tools one by one. A model choosing from seventy tools picks worse than one choosing from thirty, and the desk's whole value is a fast, correct spoken answer.

Each installed tool defaults to `unsafe` — the same Sí/No gate as the sandbox — unless the server marks it read-only. You can override per tool once a server earns trust. Servers behind OAuth hand you a login URL at install; the agent stores and refreshes the tokens itself, nothing to paste.

> This is third-party code invoked by voice. Install servers you would give a shell to.
