---
name: apollo-tooling
description: Add, remove, or gate Apollo's voice-tool capabilities — writing a new ToolDefinition, wiring it into the catalog and operating prompt, the safe/unsafe confirmation doctrine, connecting MCP servers, or enabling the coding/sandbox opt-in (Containers, GitHub App, CODING_PROXY_ORIGIN).
---

# Apollo tooling: capabilities in and out

Tools are how Apollo acts beyond talking. Built-ins live one file per concern under `src/tools/`, assembled in `src/tools/catalog.ts`, dispatched by `src/tools/router.ts`. Read `documentation/capabilities/tools.md` first; `documentation/reference/mapping.md` maps every topic to its folder.

## The safety doctrine

Every `ToolDefinition` declares `safety: 'safe' | 'unsafe'` (`src/tools/types.ts`). That field is the *only* thing that triggers confirmation — the router (`executeToolByName` in `src/tools/router.ts`) runs `safe` handlers immediately and returns `{ status: 'needs_confirm' }` for `unsafe` ones. The agent then emits `confirm_request`, the device replaces the face with the summary plus Sí/No buttons, and the handler only runs on an approved `confirm` inside the window (`CONFIRM_TIMEOUT_MILLISECONDS = 30_000`, `src/tools/types.ts`). However the window closes — button, dashboard RPC, expiry, orphan cleanup — the agent broadcasts `confirm_close` so the device never sits on a stale prompt. The pending confirmation survives the turn as a single row in the `pending_confirmations` SQLite table (`src/tools/pending.ts` — delete-then-insert, so a superseded confirmation can never resurrect).

`buildConfirmSummary` is required in practice for every `unsafe` tool, and it doubles as the argument gate: the router calls it *before* creating the confirmation, it must `parse` the args with the tool's own Zod schema, and a throw comes back as an ordinary retryable tool error (`No pude preparar la confirmación de ${toolName}: argumentos inválidos`) instead of failing the turn. Without it the device shows the useless default `Confirmar ${toolName}`.

**Structural safety beats prompt safety.** A tool earns `safe` by construction, never by instructions in the prompt. The canonical example is `send_email` (`src/tools/email.ts`, rationale in `documentation/capabilities/email.md`): the recipient is not a parameter — it is pinned to the `APOLLO_OWNER_EMAIL` secret — so the blast radius of a hallucinated call is one email to the owner's own inbox. Same pattern elsewhere: `set_weather_location` only persists on an explicit ask; `remove_from_list` requires an item match or an explicit `clearAll`. Anything genuinely destructive or able to reach a third party must be `unsafe` with a real `buildConfirmSummary`. Never "fix" safety by adding prompt text.

## Adding a tool

1. **Write the definition** in a new single-word file under `src/tools/`. Shape (`src/tools/types.ts`): `name`, `safety`, `description` (Spanish, one line — it is model-facing), `parameters` (a *shallow* JSON schema — `type: 'object'`, `properties`, `required`, `additionalProperties: false`; no nesting for nesting's sake), `handler`, and `buildConfirmSummary` if `unsafe`. The JSON schema is advisory for the model; the handler **re-parses with Zod** — that is the real gate. Return `{ ok, summary, data? }`: `summary` is spoken by TTS, so keep it to one natural sentence; `data` goes back to the model, so truncate anything unbounded (the sandbox tools pipe stdout/stderr through `truncateSandboxOutputForToolResult` — copy that discipline). Catch fetch errors and return `ok: false` with a spoken summary; a throw from a `safe` handler fails the whole turn.

Complete minimal example, `src/tools/news.ts`:

```ts
import { z } from 'zod';

import type { ToolDefinition } from '@/tools/types';

const HACKER_NEWS_FRONT_PAGE_URL = 'https://hn.algolia.com/api/v1/search?tags=front_page';
// Three headlines is as much as TTS can speak before the answer drags.
const SPOKEN_HEADLINE_COUNT = 3;
const MAXIMUM_HEADLINE_DATA_COUNT = 10;

const techNewsArgsSchema = z.object({
  query: z.string().min(1).max(120).optional(),
});

const hackerNewsResponseSchema = z.object({
  hits: z.array(z.object({ title: z.string(), url: z.string().nullable() })),
});

export function formatHeadlineListForSpeech(titleList: readonly string[]): string {
  return `Titulares: ${titleList.slice(0, SPOKEN_HEADLINE_COUNT).join('; ')}.`;
}

export const techNewsTool: ToolDefinition = {
  name: 'tech_news',
  safety: 'safe',
  description: 'Titulares de tecnología del momento (Hacker News); query opcional para filtrar',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    additionalProperties: false,
  },
  async handler(args) {
    const parsedArgs = techNewsArgsSchema.parse(args);
    try {
      const requestUrl =
        parsedArgs.query === undefined
          ? HACKER_NEWS_FRONT_PAGE_URL
          : `${HACKER_NEWS_FRONT_PAGE_URL}&query=${encodeURIComponent(parsedArgs.query)}`;
      const response = await fetch(requestUrl);
      if (!response.ok) {
        return { ok: false, summary: `No pude traer los titulares (HTTP ${response.status})` };
      }
      const payload = hackerNewsResponseSchema.parse(await response.json());
      if (payload.hits.length === 0) {
        return { ok: true, summary: 'No hay titulares para eso ahora.' };
      }
      return {
        ok: true,
        summary: formatHeadlineListForSpeech(payload.hits.map((story) => story.title)),
        data: payload.hits.slice(0, MAXIMUM_HEADLINE_DATA_COUNT),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'error desconocido';
      return { ok: false, summary: `No pude traer los titulares (${errorMessage})` };
    }
  },
};
```

Repo conventions apply: long descriptive identifiers, booleans `is/has/should`, collections end in `List`, no comments except a non-obvious *why*. Tools needing agent state (SQLite, reminders, focus) go through `context.effects` (`DeskToolEffects` in `src/tools/types.ts`) and must handle `context.effects === undefined` with a spoken `'Effects no disponibles'` — see `src/tools/list.ts` for the pattern, and add the effect to `DeskToolEffects` plus its implementation in the agent when you need a new one.

2. **Register it** in `src/tools/catalog.ts`: import, and append to the array in `listBuiltinToolDefinitionList()`.

3. **Name it in the operating prompt.** Add a clause to `apolloOperatingBasePrompt` in `src/persona/soul.ts`, e.g. `'tech_news para titulares de tecnología. '`. This is not optional: as the comment above `buildInstalledToolPromptNote` states, the base prompt names every builtin in prose — a builtin absent from the prose reaches the model through the function schema alone and gets picked far less reliably. Match the existing register (rioplatense Spanish, terse, verb-first).

4. **Test it** beside the code: `src/tools/__tests__/news.spec.ts`. Test exported pure helpers directly (`src/tools/__tests__/dollar.spec.ts` is the model — it asserts exact spoken strings):

```ts
import { describe, expect, it } from 'bun:test';

import { formatHeadlineListForSpeech } from '@/tools/news';

describe('formatHeadlineListForSpeech', () => {
  it('speaks at most three headlines', () => {
    expect(formatHeadlineListForSpeech(['A', 'B', 'C', 'D'])).toBe('Titulares: A; B; C.');
  });
});
```

For `unsafe` tools also assert that `buildConfirmSummary` throws on bad args and produces a human summary on good ones.

5. **`bun run check`** — lint, format, typecheck, test. Not done until it passes.

## Removing a tool

Four deletions, mirror of adding — `dollar_rate` as the worked example:

1. `src/tools/catalog.ts` — remove the `dollarRateTool` import and its array entry.
2. Delete `src/tools/dollar.ts` and its backing module `src/rates/dollar.ts` (one tool per file means removal is a file deletion, not surgery).
3. `src/persona/soul.ts` — remove the prose clause (`'dollar_rate para cotizaciones del dólar. '`); a prompt that promises a tool the catalog no longer has teaches the model to call `Herramienta desconocida`. Prompt-prose edits are the `apollo-persona` skill's territory — cross-reference it if you are reshaping more than the one clause.
4. Delete `src/tools/__tests__/dollar.spec.ts`, then `bun run check`.

Also drop the tool's line from `documentation/capabilities/tools.md` if you keep the handbook current.

## MCP: two opposite directions

`src/mcp/` holds both, sharing nothing but a protocol name. Depth lives in `documentation/capabilities/mcp.md`; this is orientation.

**Outbound — installed servers.** The owner connects external MCP servers at runtime, no deploy. `@callable()` RPC on the Durable Object: `installMcpServer` (returns `READY` or `AUTHENTICATING` + `authUrl` for OAuth), `uninstallMcpServer`, `listMcpServers`, `enableMcpTool`/`disableMcpTool`. URLs must be absolute `https` (`src/mcp/servers.ts`). A newly installed server contributes **nothing** — every tool is opt-in by name (`mcp_tool_settings` table, `src/mcp/settings.ts`), because a model choosing among seventy tools picks worse than one choosing among thirty. Installed tools reach the model as `mcp_{serverId}_{toolName}_{hash}` (sanitized to `/^[A-Za-z0-9_]+$/`, capped at 64 chars, hash of the raw identity — `src/mcp/naming.ts`); nothing ever parses the name back apart, and built-ins are appended last so an installed server can never capture a catalog name. Safety default: an installed tool is `unsafe` unless the server marks it `readOnlyHint`, and never enabled if it marks `destructiveHint`; the owner can override per tool. Server tool descriptions land in the system prompt verbatim — install servers you would give a shell to.

**Inbound — the device bridge** (`src/mcp/bridge.ts`). Apollo calls tools *on the firmware* over the device WebSocket using MCP `tools/call` framing with integer request ids. The catalog wrappers `set_volume`, `set_brightness`, `device_status` (`src/tools/device.ts`) forward to the firmware's `self.*` tools — `self.audio_speaker.set_volume`, `self.screen.set_brightness`, `self.get_device_status`. To surface a new firmware capability, add a `self.*` tool in firmware, then a thin catalog wrapper going through `context.effects.callDeviceTool`.

## Enabling coding (the sandbox opt-in)

The starter ships with sandbox/coding **off**: no `containers` block, no `Sandbox` binding, `Env['Sandbox']` optional (`src/configuration/environment.d.ts`). In that state `sandbox_run_code`, `sandbox_exec`, and the coding tools answer with the spoken summaries in `src/sandbox/capability.ts` — `'El sandbox no está habilitado en este despliegue: requiere Cloudflare Containers y el plan Workers Paid.'` / `'No puedo programar en este despliegue: el sandbox de Cloudflare Containers no está habilitado.'` — and `/health` omits `coding`.

**Requirements:** Workers Paid ($5/mo — Containers are not on the free plan) and Docker running locally at deploy time (wrangler builds the image). Everything else in the starter stays free-plan.

**Runbook:**

1. Add to `wrangler.jsonc` — the `containers` block, the extra Durable Object binding alongside the existing `Apollo` one, and a new migration tag appended after the last existing tag (`"v2"` if the starter still has only `"v1"`; never edit shipped tags):

```jsonc
"containers": [
  {
    "class_name": "Sandbox",
    "image": "./Dockerfile",
    "instance_type": "standard-1",
    "max_instances": 1,
  },
],
```

```jsonc
{ "name": "Sandbox", "class_name": "Sandbox" },
```

```jsonc
{ "tag": "v2", "new_sqlite_classes": ["Sandbox"] },
```

`instance_type` must stay `standard-1` — `lite` cannot hold a clone plus an install. The `Dockerfile` already ships in the starter (cloudflare/sandbox base plus a checksum-pinned opencode binary); do not touch it. Confirm `src/index.ts` still has `import { Sandbox } from '@cloudflare/sandbox'` and exports it — `class_name: "Sandbox"` resolves against that export.

2. `bun run types` to regenerate `worker-configuration.d.ts` from the edited config, then `bun run check`.

3. **Create the GitHub App** (Settings → Developer settings → GitHub Apps):
   - Permissions: **Contents: read & write**, **Pull requests: read & write**, **Metadata: read**. Nothing else.
   - Install it on exactly the repositories Apollo may touch — the installation list *is* the allowlist; anything else fails at `GET /repos/{owner}/{repo}/installation` before a container boots.
   - Generate a private key. GitHub hands out PKCS#1 (`BEGIN RSA PRIVATE KEY`) and WebCrypto needs PKCS#8, so convert first:

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in key.pem -out key-pkcs8.pem
```

4. **Secrets**, through the same bootstrap path as the rest (`bunx wrangler secret put <NAME>`): `GITHUB_APP_ID` (the App's numeric id) and `GITHUB_APP_PRIVATE_KEY` (the converted PKCS#8 PEM). Commits and PRs will be authored as `<app-slug>[bot]`, not as you.

5. **Deploy**, then set `CODING_PROXY_ORIGIN` — ordering matters. The opencode engine inside the sandbox calls back to the worker's own `/coding-llm/v1/chat/completions` route (`src/coding/proxy.ts`), so the value must be *this deployment's own* `https` origin (e.g. `https://apollo.example.workers.dev` or your custom domain) — and you only know that URL after the first deploy. Until it is set, coding runs but falls back to the legacy hand-rolled agent loop (`src/workflows/coding.ts`: opencode requires `CODING_ENGINE !== 'legacy'` *and* a defined proxy origin). Set it as a secret and redeploy. The proxy exists so the real `OPENROUTER_API_KEY` never enters the sandbox — it only sees a short-lived HMAC token, pinned to `OPENROUTER_CODING_MODEL`.

6. **Escape hatch:** `CODING_ENGINE=legacy` forces the hand-rolled loop even with the proxy origin set — use it if opencode misbehaves.

7. **Verify:** `curl https://<your-origin>/health` — `features` must now include `'coding'` (`src/index.ts` appends it only when the `Sandbox` binding exists). Then say a coding task out loud; `start_coding_task` is `unsafe`, so one Sí on the device authorizes the whole run.

To disable again, revert the `wrangler.jsonc` additions (keep the migration tag — tags are history), rerun `bun run types`, redeploy; the tools degrade back to the spoken summaries.
