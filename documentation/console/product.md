# Console product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19, Tailwind v4 + shadcn/ui, deployed as an assets-only Cloudflare Worker at apollo-console.galfre-vn.workers.dev. (console.apollodevice.com is the planned domain once it is acquired; the social meta in `index.html` points at the workers.dev host until then.)

## Users

Owners of an Apollo desk device — technical people who deployed the Apollo agent worker to their own Cloudflare account and flashed the ESP32 firmware. They open the console occasionally from a desktop browser to check on the device and manage the agent; the voice device itself is the primary product surface. (Inferred from the repo and the user's brief: today the sole user is the project author; the connect-with-your-own-worker-URL flow implies any Apollo owner may use it.)

## Product Purpose

A management dashboard for the Apollo agent. It connects directly to the owner's deployed worker over WebSocket and lets them: watch live status (UI state, device connectivity, battery/RSSI/firmware telemetry), manage MCP servers and per-tool enablement, browse the agent's memory (raw memories and the consolidated owner-memory block, plus lists), and view/cancel reminders and timers. Success is the owner trusting what the agent knows and controlling what it can do without touching wrangler or SQL.

## Positioning

The worker serves two surfaces: the marketing landing at `/` (see [Landing](landing.md)) and the console at `/console`. The console is the management UI for Apollo. It explains the agent's internal state rather than configuring infrastructure — panels answer "what does my agent know/see/plan" — and it is stateless: the console stores nothing server-side; every fact shown comes live from the owner's own worker.

## Operating Context

The owner enters their worker URL, device instance name (default `desk`), and the dashboard shared secret on a connect screen; the console keeps that in localStorage only. All reads/mutations are secret-gated RPCs over the agent WebSocket; live state arrives via the agents SDK state sync. The desk device (ESP32, 1.85" round-ish display) may be online or offline while the console is open. The agent speaks Spanish to its owner, and both web surfaces are bilingual with Spanish as the principal language: locale is auto-detected from the browser (stored choice wins, unsupported languages fall back to Spanish), persisted in localStorage, and switchable via an es/en toggle in the landing nav, the console header, and the connect screen. Message catalogs are typed TS modules colocated per area (`src/<area>/copy.ts`, `src/landing/copy/`), with `src/locale/` providing detection, context, Intl date formatting, and the toggle. Dates follow the app locale, not the browser locale.

## Capabilities and Constraints

- V1 areas (user-confirmed): MCP servers & tools, live status & telemetry, memory browser, schedules & reminders.
- The console must never take the device's protocol path (dashboard connections are deliberately excluded from device message handling) and never call agent state writes; it is read-and-RPC only.
- MCP servers can require OAuth: install returns an authUrl the owner must open; server state may be `authenticating`/`failed`; tool enablement is opt-in with safety levels (`safe`/`confirm`/`unsafe`).
- Telemetry is a snapshot with staleness (receivedAtMs), not a stream; the device pushes it only while connected.
- Repo conventions are binding: single-word filenames, long descriptive identifiers, zod at every boundary, no comments except non-obvious why, ~300-line file cap. Vendored shadcn components under `apps/console/src/components/ui/` are the sanctioned exception.

## Brand Commitments

Name: "Apollo Console". Binding visual direction (user-revised 2026-08-12, superseding the earlier amber pixel-console look, which itself superseded the stacked-echo blueprint look): a quiet monochrome instrument language, dark only. Grayscale-only chrome — #0d0d0d ground, #0c0c0c cards, #1d1d1d hairline borders, #fafafa ink, #878787/#666666 grays — red reserved for failure; no accent color of any kind. Hedvig Letters Sans for all UI with Hedvig Letters Serif for the single overview greeting; square corners everywhere (rounded only on the switch and status dots); elevation by 1px border, never shadow; Material Design outline icons via a single Icons object; the face mark — the device's square screen with two punched capsule eyes — is the brand, rendered monochrome (chosen 2026-08-12, superseding the four-square cluster). Sentence case; no tracked-uppercase labels. The identity is Apollo's own — no third-party branding anywhere in the chrome.

## Evidence on Hand

The agent's real data models in `apps/agent/src/`: `ApolloState`, `McpServerSummary`, `DeskTelemetrySnapshot`, `ConsoleStatusSnapshot`, `MemoryRecord`, `OwnerFact`, `ListItemRecord`, `ScheduledReminderRow`. Reference screenshot of the aesthetic: user-supplied Cloudflare Sandbox landing image (not in repo). No testimonials, logos, or invented marketing claims exist — the landing at `/` is the only marketing surface, and it states repo facts only.

## Product Principles

- Explain, don't just configure: every panel should make the agent's internal state legible.
- Live truth over cached truth: show what the worker says now, and show staleness honestly.
- The device is the hero; the console is the instrument panel around it.
- One secret gates everything: never weaken the token model for convenience.
- Stateless console: losing the browser loses nothing but a saved connection.

## Navigation

Prev: [Testing](../operations/testing.md) · Next: [Design](design.md)
