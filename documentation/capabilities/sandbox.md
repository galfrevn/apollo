# Sandbox

Sandbox tools run untrusted or heavy code away from the agent isolate.

## Tools

- `sandbox_run_code` — run a code snippet in the sandbox
- `sandbox_exec` — execute a command-style request inside the sandbox environment

## Confirmation flow

Both tools are `safety: 'unsafe'`, so the router never runs them directly: it returns a pending confirmation, the agent sends `confirm_request`, and the handler only fires once the device answers `confirm`. The pending confirmation is written to the `pending_confirmations` table rather than kept on the instance — the confirm window is idle by nature, and a hibernating agent would otherwise wake with no memory of what it asked. The expiry timer carries the confirmation id so a resolved confirmation's timer cannot cancel a later one.

## Infrastructure

Cloudflare Sandbox / Containers bindings are declared in `wrangler.jsonc` (`Sandbox` class, container image). Runner helpers live under `src/sandbox/`.

Containers require the Workers Paid plan to deploy. Local development does not: `wrangler dev` builds and runs the image in your own Docker, so the full path is exercisable on the free plan.

## Product fit

Use the sandbox when the user needs computation or inspection that should not block or endanger the desk agent process. Prefer returning a concise spoken summary over dumping raw logs to TTS.

## Navigation

Prev: [Reminders](reminders.md) · Next: [Setup](../operations/setup.md)
