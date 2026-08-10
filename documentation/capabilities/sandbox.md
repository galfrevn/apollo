# Sandbox

Sandbox tools run untrusted or heavy code away from the agent isolate.

## Tools

- `sandbox_run_code` — run a code snippet in the sandbox
- `sandbox_exec` — execute a command-style request inside the sandbox environment

Both are `safety: 'unsafe'`, which makes them the only tools that trigger the
confirmation flow — see [Tools](tools.md).

## Infrastructure

The `containers` block and the `Sandbox` durable object binding are declared in
`wrangler.jsonc`, and both tools are registered in `src/tools/catalog.ts`. The `Sandbox`
class is exported from `src/index.ts` because `Env['Sandbox']` in
`worker-configuration.d.ts` needs it to resolve. Runner helpers live under
`src/sandbox/`. Local runs need Docker.

Containers require the Workers Paid plan to deploy. Local development does not: `wrangler dev` builds and runs the image in your own Docker, so the full path is exercisable on the free plan.

## Product fit

Use the sandbox when the user needs computation or inspection that should not block or endanger the desk agent process. Prefer returning a concise spoken summary over dumping raw logs to TTS.

## Navigation

Prev: [Email](email.md) · Next: [Coding](coding.md)
