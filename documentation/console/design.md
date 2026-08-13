# Console design

The visual authority for console work, documented from the code as built. Direction (binding, user-pinned 2026-08-12): a quiet monochrome instrument language — full monochrome, dark only, square corners, elevation by hairline border. This supersedes the amber pixel-console look, which itself superseded the stacked-echo blueprint look; both are rejected — never reintroduce either. See [Product](product.md) "Brand Commitments" and the direction contract in `apps/console/index.html`.

## Color

All tokens live in `apps/console/src/index.css` under `@theme`; the default Tailwind palette is disabled (`--color-*: initial`), so these are the only colors available.

| Token                | Value                    | Role |
| -------------------- | ------------------------ | ---- |
| `background`         | `#0d0d0d`                | Page ground, scrollbar track, opened-document wells, header (`bg-background/70` + blur), dialog overlay (`/80`) |
| `foreground`         | `#fafafa`                | Primary text, live/busy chip dots, selection fill, caret |
| `card`               | `#0c0c0c`                | Panel, tile, dialog, and form-card surfaces; empty-state message pill |
| `card-hover`         | `#0f0f0f`                | Hover fill for clickable tiles and list rows |
| `active`             | `#131313`                | Active nav item fill |
| `border`             | `#1d1d1d`                | Every border (set as the global `border-color`), scrollbar thumb |
| `border-hover`       | `#222222`                | Border on hovered tiles/inputs, scrollbar thumb hover |
| `accent`             | `#1c1c1c`                | Neutral fills: chip/badge/kbd background, ghost-button and search-row hover, unchecked switch track |
| `primary`            | `#fafafa`                | Solid button fill, checked switch track |
| `primary-foreground` | `#171717`                | Text on solid buttons, checked switch thumb |
| `muted-foreground`   | `#878787`                | Secondary text: panel titles, labels, descriptions, placeholders, insight prose |
| `dim`                | `#666666`                | Tertiary text: metadata, timestamps, inactive nav items, staleness notes |
| `destructive`        | `hsl(359deg 100% 61%)`   | Failure only: errors, `down` chips, destructive buttons/badges |
| `ring`               | `hsl(240deg 4.9% 83.9%)` | The global `:focus-visible` outline (1px solid, 2px offset) |

There is no accent hue. "Live/online" is white (`foreground`), not green; positive/active states are grayscale. Red pairs `text-destructive` + `bg-destructive/10` + `border-destructive/40` and appears only when something failed. Selection is inverted (`foreground` fill, `background` text). One raw value exists outside the table: the `dotted-bg` utility draws 1px `#232323` dots on a 6px grid (used only inside Empty).

## Typography

Three self-hosted faces in `apps/console/src/fonts/`, declared in `apps/console/src/index.css`:

- **Hedvig Letters Sans** (`font-sans`, the default) — all UI text. Ships weight 400 only; `font-medium` therefore resolves to 400 by design — weight classes are rhythm markers, not visible weight changes. Sentence case throughout.
- **Hedvig Letters Serif** (`font-serif`) — display moments only. Exactly two exist: the overview greeting (`text-[38px] leading-tight`, `apps/console/src/status/insights.tsx`) and the connect-screen title (`text-[32px] leading-tight`, `apps/console/src/connection/screen.tsx`). [Product](product.md) says "the single overview greeting"; the build added the connect title as a second — both are pre-shell display moments, no serif appears inside page content.
- **JetBrains Mono** (`font-mono`, variable 100–800) — one use: the jobs document viewer `<pre>` (`text-xs leading-relaxed`, `apps/console/src/jobs/page.tsx`). Never elsewhere, not even for URLs or telemetry values.

Scale as used: page `Heading` is `text-xl font-medium tracking-tight`; dialog titles `text-lg font-medium tracking-tight`; body and controls `text-sm`; labels, chips, metadata `text-xs`; the ⌘K kbd hint `text-[10px]`. Labels (`ui/label.tsx`) are `text-xs font-medium text-muted-foreground`, sentence case — no uppercase, no letter-spacing. Tables get `tabular-nums` globally.

## Radius

Square everywhere — no `rounded-*` class exists in the tree except `rounded-full` in exactly two places: the Switch (track and thumb) and the 1.5-size status dot inside Chip. Panels, buttons, inputs, dialogs, tiles, badges, chips, nav items: all hard corners.

## Icons

One `Icons` object in `apps/console/src/components/icons.tsx`; nothing imports icon components directly. Nine Material Design **outline** icons from `react-icons/md` (Close, History, Jobs, Logout, Mcp, Memory, Schedules, Search, Status) plus `LogoMark` — the brand: a hand-drawn 20×20 SVG of the device's face, a solid `currentColor` square with two capsule eyes punched out (even-odd fill, so the ground shows through). Masters and social assets live in `branding/` at the repo root; the favicon set is in `apps/console/public/`. Rendered monochrome at 20–22px in the rail and mobile header, 26px on the connect screen. Icon sizes in use: 16, 18, 20, 22, 26.

## Components

`apps/console/src/blueprint/` — console-specific primitives:

- **Panel** — `border bg-card`, square; optional 44px (`h-11`) header with a `text-sm text-muted-foreground` title and a `meta` slot.
- **Chip** — square status tag (`border px-2 py-0.5 text-xs font-medium`) with a round 1.5 dot. Tones: `live` (accent fill, foreground dot pulsing at 2s), `busy` (same at 1s), `idle` (muted text, static dot), `down` (destructive text and `/40` border on transparent — the only red chip).
- **Heading** — `text-xl font-medium tracking-tight` h1 with optional muted description. No mark, no ornament.
- **Empty** — dashed border box with `dotted-bg` texture; the message sits on a `bg-card` pill in `text-xs font-medium text-muted-foreground`.

`apps/console/src/components/ui/` — vendored shadcn-style primitives on Radix, restyled to the tokens (the sanctioned multi-export exception):

- **Button** — variants `default` (solid `primary` fill, `primary-foreground` text, `/90` on hover), `outline` (border, transparent, `bg-accent` hover), `ghost` (muted text, `bg-accent` hover), `destructive` (red text on transparent, red-tint hover). Sizes `default` h-9, `sm` h-8 `text-xs`, `lg` h-10, `icon` 9×9. All square, `transition-colors duration-150`.
- **Badge** — static square tag, same frame as Chip minus the dot. Variants `default` (accent fill), `strong` (`foreground/10` fill), `destructive`, `outline` (muted text).
- **Input** — h-9, `border bg-transparent`; hover `border-border-hover`, focus `border-dim`. No ring, no shadow, square.
- **Switch** — the rounded exception: `h-5 w-9 rounded-full`, `bg-accent` track → checked `bg-primary`, `bg-dim` thumb → checked `bg-primary-foreground`.
- **Dialog** — `bg-background/80` flat overlay (no blur); content is a square `border bg-card p-6` card, max-w-md, entering with `settle`, close icon top-right in `text-dim`.
- **Sheet** — non-modal reading panel: `fixed top-[70px] right-0 bottom-0 lg:w-1/3 border-l bg-card`, sliding in with the `sheet` keyframe; the page it serves adds a matching right margin so content is pushed, never covered. Outside interaction is allowed and does not dismiss; Escape and the close icon do.
- **Slider** — square-thumb Radix slider: h-1 `bg-accent` track, `bg-primary` range, `size-3.5 bg-foreground` bordered thumb; commits on release.
- **Skeleton** — `animate-pulse bg-accent` block, always shaped to the final content's box so nothing shifts on load.
- **Label** — `text-xs font-medium text-muted-foreground`.

Signature patterns: **stat tiles** (`apps/console/src/status/tiles.tsx`) are `min-h-[110px] border bg-card p-5` with an xs muted label above a `text-xl font-medium` value; clickable ones hover to `border-border-hover bg-card-hover` over 300ms. **Insight fragments** (`apps/console/src/status/insights.tsx`) are dashed underlines — `border-b border-dashed border-muted-foreground/40 text-foreground` inside muted sentences; navigable ones are buttons whose dash darkens on hover. **⌘K search** (`apps/console/src/layout/search.tsx`) is a Dialog pinned to `top-[20%]` with a borderless h-12 input row and a filtered route list.

## Motion

- `settle` — 0.45s `cubic-bezier(0.16, 1, 0.3, 1)` fade-up from 6px; applied to every page root, the connect card, and dialog content. The only entrance animation.
- `signal` — opacity pulse (1 → 0.35) for chip dots; 2s on `live`, 1s on `busy`.
- Everything else is `transition-colors duration-150`, with two slower cases: stat tiles at 300ms and the rail expansion at 200ms `cubic-bezier(0.4, 0, 0.2, 1)` (width plus label opacity fade).
- The 3D device auto-rotates at speed 0.9 with damping — disabled when `prefers-reduced-motion` matches.
- A global reduced-motion guard in `apps/console/src/index.css` collapses all animation and transition durations to 0.01ms.

Structural motion is limited to three moves: the rail's push (margin animation on the content column), the Sheet's 0.4s slide-in from the right (`sheet` keyframe, same ease family as `settle`), and the Skeleton pulse. No scale, spring, or blur transitions; no spinners.

GSAP is sanctioned only on the landing surface (`src/landing/`), never in the console chrome — see [Landing](landing.md) for its motion policy.

## Layout

- **Rail** (`apps/console/src/layout/nav.tsx`) — fixed left, full height, `hidden md:flex`; 70px wide collapsed, expanding to 240px (`w-60`) on hover or focus. The expansion pushes: the shell animates the content column's `margin-left` from 70px to 240px in step with the rail, so nothing is ever covered. Three bands: 70px brand row (LogoMark + "Apollo Console"), nav list (h-10 square items, active = `border-border bg-active text-foreground`, inactive = `text-dim` borderless), 70px identity footer (device initial in a bordered `bg-accent` square, device name + worker host).
- **Header** (`apps/console/src/layout/shell.tsx`) — sticky, 70px, `border-b bg-background/70 backdrop-blur-xl`, z-40. Left: LogoMark (mobile only) + search trigger; right: connection Chip (`Link up` live / `Linking` busy / `Unauthorized` down) + ghost disconnect button.
- **Content** — everything offset `md:ml-[70px]`, animating to `md:ml-60` while the rail is expanded. Main is `px-4 py-6 md:px-8`. Section pages: `settle space-y-5`/`space-y-6`, full width. Overview: a single centered `mx-auto max-w-3xl space-y-8` column (greeting → insights → confirm/caption → tiles), vertically centered in the viewport below the header on md+. Device page: `lg:grid-cols-2 gap-6` — the 3D model centered in the left half (`min-h-[28rem]`), a self-centered stack of Mode / Volume & brightness / Weather location panels on the right. The jobs page adds `lg:mr-[calc(100vw/3)]` while its Sheet is open, squeezing in step with the panel.
- **Mobile** — rail hidden; a `scrollbar-hide` horizontal chip row of h-9 square nav buttons under the header.
- **Connect screen** — centered `max-w-sm` column: LogoMark, serif title, muted tagline, one bordered form card, `text-dim` privacy note.
- Scrollbars are themed: 10px, `background` track, `border` thumb with a 2px background inset.

## States

- **Loading** — skeletons everywhere: every async region renders pulse skeletons shaped like its final layout (list rows, tile values, insight lines, slider rows, document paragraphs), so nothing flashes or moves when data arrives. No spinners, no loading text.
- **Empty** — the Empty component with a factual, actionable message ("No run documents yet — ask the desk to research something").
- **Inline error** — `role="alert"`, `text-xs text-destructive`, bordered red-tint strip (`border-destructive/40 bg-destructive/10 px-3 py-2`) for form/RPC failures; bare red text for the status-poll notice, which states the retry cadence.
- **Banner error** — the same red-tint recipe as a full-width strip under the header when the worker refuses the secret.
- **Staleness** — telemetry older than 5 minutes is called out in `text-dim` ("Snapshot 3 h ago — stale; the device pushes telemetry only while connected"). Never hidden.
- **Liveness** — Chip tones carry connection truth: shell socket open → `live`, unauthorized → `down` (destructive), connecting → `busy`; MCP servers map ready → `live`, authenticating/connecting/discovering → `busy`, anything else → `down`.

## The 3D device

`apps/console/src/device/model.tsx`, rendered with three.js via `@react-three/fiber` + `@react-three/drei`, lazy-loaded (`apps/console/src/device/page.tsx`) behind a Suspense placeholder so the bundle stays off every other page. It owns the Device route alongside the Mode / Volume & brightness / Weather panels; changing the mode there re-colors the ring live, so the model is the mode picker's preview.

- **Geometry** — a black cylinder, radius 1 (diameter equals height, the real 4 × 4 cm proportions): a straight `#2e2e2e` body section, a tapering base (radius 1 → 0.8 over the bottom 0.45) so the foot closes like the real enclosure, and a dark `#0a0a0a` seam band 0.5 below the top (the physical 1 cm separator line). A matte `#030303` screen disc (r 0.86) on top carries two white (`#FAFAFA`) circular eyes (r 0.19 at x ±0.38) and a flat accent ring (inner 0.78 → outer 0.86), `toneMapped={false}` so it reads as emissive. Body hardware matches the device: USB-C and USB-A recesses with `#242424` bezels on the lower front, two `#d4d4d4` charge-light dots above them, a `#242424`/`#3a3a3a` slide switch on the left, two slot buttons on the right.
- **Blink** — every 10 s the eyes squash to 8% height and back over 0.28 s (sine ease in `useFrame`), skipped under reduced motion.
- **Ring color** — content truth, not UI accent: `SPEECH_MODE_ACCENT_MAP` keyed by the agent's live `speechMode` — `default` `#FFFFFF`, `nerd` `#F5C518`, `playful` `#C45C26`, `warm` `#B56B7A` — mirroring `apps/agent/src/persona/catalog.ts`, which is the source of truth. Unknown or absent modes fall back to `default`. This is the only place non-grayscale color may appear outside failure red, because the device itself shows it.
- **Interaction** — OrbitControls rotate-only (no pan, no zoom), polar angle clamped (0.35 to π/2 + 0.2), damping 0.08; auto-rotate 0.9 unless reduced motion. Container is `h-[26rem] max-w-md cursor-grab active:cursor-grabbing` with `role="img"` and a drag-to-rotate aria-label.
- **Scene** — camera `[3.1, 2.3, 3.1]` fov 34, dpr `[1, 2]`; hemisphere (`#4a4a4a`/`#101010`, 1.4) + ambient 0.5 + three directionals (2.2 key, 1.1 rim, 0.5 low fill) so the black body keeps visible form; a soft black ContactShadows disc under the device (opacity 0.45, blur 2.4) — a 3D grounding shadow inside the canvas, not a UI elevation shadow.

## Hard rules

- **Monochrome.** No accent color in UI chrome — no amber, no green, no blue. Grayscale carries every positive/active state.
- **Red means failure.** `destructive` appears only for errors, refusals, and destructive actions — never for emphasis.
- **The device ring is content, not chrome.** Its colors come from the agent's persona catalog and appear only on the 3D model. Never promote them into buttons, chips, links, or any UI element.
- **Dark only.** `color-scheme: dark` in CSS and meta; no light theme, no toggle.
- **Square corners.** `rounded-full` is legal on exactly the Switch and the Chip status dot; every other `rounded-*` class is banned.
- **Elevation by border.** 1px `border` hairlines separate surfaces; `background` → `card` → `accent` is the full depth range. No drop shadows in the UI (the 3D canvas's ContactShadows is scene lighting, not elevation).
- **Sentence case everywhere.** No uppercase labels, no tracked-out smallcaps.
- **Mono only in the jobs document viewer.** URLs, telemetry, and identifiers render in the sans face like everything else.
- **Serif is a display voice**, limited to the overview greeting and the connect-screen title.
- **One Icons object.** All glyphs route through `apps/console/src/components/icons.tsx`; Material outline style only.
- **The dashboard secret** is entered via `type="password"` and never rendered anywhere in the UI.
- **The face LogoMark is the only brand mark** — the device's square screen with two punched capsule eyes; no third-party logos or names anywhere in the chrome (connector logos inside the MCP catalog are content, not chrome).

## Navigation

Prev: [Product](product.md) · Next: [Landing](landing.md)
