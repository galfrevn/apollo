# Sandbox

Sandbox tools run untrusted or heavy code away from the agent isolate.

## Tools

- `sandbox_run_code` — run a code snippet in the sandbox
- `sandbox_exec` — execute a command-style request inside the sandbox environment

## Infrastructure

Cloudflare Sandbox / Containers bindings are declared in `wrangler.jsonc` (`Sandbox` class, container image). Runner helpers live under `src/sandbox/`.

## Product fit

Use the sandbox when the user needs computation or inspection that should not block or endanger the desk agent process. Prefer returning a concise spoken summary over dumping raw logs to TTS.

## Navigation

Prev: [Reminders](reminders.md) · Next: [Setup](../operations/setup.md)
