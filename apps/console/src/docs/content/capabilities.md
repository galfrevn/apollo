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

A few have character worth knowing. Timers and pomodoros ride the reminder scheduler — a pomodoro also activates focus mode, and `cancel_reminder` cancels timers too. Lists are durable spoken lists in the desk's own SQLite, with a default list named "super". The conversation pair reaches back into past threads: recall what was said, or resume one where it left off. `dollar_rate` quotes Argentine exchange rates from a keyless public API. `web_search` answers in one turn; `start_research` leaves the turn entirely and returns later as a background result, with the full report also emailed to you. The device trio rides the MCP bridge from the Protocol chapter into the firmware itself, so the agent can adjust the volume, dim the screen, or read the hardware status of the body it lives in. The sandbox pair and the coding pair — clone a repository, make a change, run the tests, open a pull request, all by voice — are the opt-in tier that needs extra provisioning.

## Asking first

Every tool declares `safety: 'safe'` or `'unsafe'`, and that field is the only thing that triggers confirmation. When the model requests an unsafe tool, the router returns the request instead of running it, the server sends `confirm_request`, and the device replaces the face with a summary plus Sí/No buttons. The side effect runs only on an approved `confirm` within 30 seconds; however the window ends — button, console, expiry — the device always receives `confirm_close`, so it never sits on a stale prompt. In the shipped catalog the unsafe tools are the sandbox pair and `start_coding_task`.

Tools that look risky but are `safe` earn it structurally rather than by review: `send_email` cannot choose a recipient — it is pinned to your own address — `set_weather_location` only persists after an explicit ask, and `remove_from_list` needs an item match or an explicit clear-all. The doctrine: safety is built into the tool's shape, never delegated to prompt instructions.

## Extending with MCP

The catalog is the compiled-in half. The other door is the Model Context Protocol: from the console you connect an external MCP server at runtime — no deploy, no flash — and its tools merge into the same map on every turn.

Installed tools are strictly opt-in. A newly connected server contributes nothing until you enable its tools one by one, because a model choosing from seventy tools picks worse than one choosing from thirty, and the desk's whole value is a fast, correct spoken answer. Each installed tool defaults to `unsafe` — the same Sí/No gate as the sandbox — unless the server marks it read-only, and you can override per tool once a server earns trust. Servers behind OAuth hand you a login URL at install; tokens are stored and refreshed by the agent itself, nothing to paste. This is third-party code invoked by voice: install servers you would give a shell to.
