# Sandbox

Sandbox tools run untrusted or heavy code away from the agent isolate.

> **Not currently active.** Cloudflare Containers require the Workers Paid plan, so the
> container image and the `Sandbox` Durable Object binding are commented out in
> `wrangler.jsonc`, and both tools are commented out of `src/tools/catalog.ts`. The code
> is complete and tested — this chapter describes what re-enabling it restores.

## Tools

- `sandbox_run_code` — run a code snippet in the sandbox
- `sandbox_exec` — execute a command-style request inside the sandbox environment

Both are `safety: 'unsafe'`, which makes them the only tools that trigger the
confirmation flow — see [Tools](tools.md).

## Infrastructure

Re-enabling means three edits: the `containers` block and the `Sandbox` durable object
binding in `wrangler.jsonc`, and the two catalog entries. The `Sandbox` class stays
exported from `src/index.ts` either way, because `Env['Sandbox']` in
`worker-configuration.d.ts` needs it to resolve. Runner helpers live under
`src/sandbox/`. Local runs need Docker.

## Product fit

Use the sandbox when the user needs computation or inspection that should not block or endanger the desk agent process. Prefer returning a concise spoken summary over dumping raw logs to TTS.

## Navigation

Prev: [Email](email.md) · Next: [Setup](../operations/setup.md)
