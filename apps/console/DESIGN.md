# Apollo Console — Design System

The visual authority for console work, documented from the code as built. Direction (binding, user-revised 2026-08-12): a modern dark console with pixel accents. The earlier stacked-echo blueprint look was rejected as over-stylized — never reintroduce it. See PRODUCT.md "Brand Commitments".

## Color

All tokens live in `src/index.css` under `@theme`; the default Tailwind palette is disabled (`--color-*: initial`), so these are the only colors available.

| Token       | Value                       | Role |
| ----------- | --------------------------- | ---- |
| `ground`    | `#0b0b0d`                   | Page background, input background, text on amber buttons |
| `panel`     | `#111114`                   | Card and dialog surfaces, header (`bg-panel/70` + blur) |
| `raised`    | `#19191d`                   | Hover fills, active nav item, neutral badge/switch fill |
| `line`      | `#26262c`                   | Borders everywhere (set as the global `border-color`), grid gap fill, inactive dots |
| `linefaint` | `rgba(235,235,242,0.05)`    | Dot-grid and pixelfield dots only |
| `ink`       | `#ececf1`                   | Primary text |
| `muted`     | `#a3a3ad`                   | Secondary text, panel titles, labels |
| `faint`     | `#8a8a96`                   | Tertiary text, placeholders, mono metadata, down-state |
| `amber`     | `#f5a623`                   | The single accent: mark, live states, focus, selection, caret, primary button (`#ffb83d` on hover) |
| `amberdim`  | `rgba(245,166,35,0.12)`     | Amber tint fills (live chip, amber badge, checked switch) |
| `danger`    | `#ec5a5f`                   | Errors and destructive actions only |
| `dangerdim` | `rgba(229,72,77,0.12)`      | Danger tint fills (alert banner, destructive hover) |

Amber accents pair `text-amber` + `bg-amberdim` + `border-amber/40`; danger mirrors this with its dim. There is no green, blue, or any second accent — "live/online" is amber, not green.

## Typography

Two variable-weight faces, self-hosted in `src/fonts/`:

- **Archivo** (`font-sans`, the default) — all UI text: headings, labels, buttons, body. Sentence case throughout. Headings use `font-semibold tracking-[-0.01em]` (page title `text-2xl`, dialog title `text-lg`).
- **JetBrains Mono** (`font-mono`) — strictly data values: telemetry readings, URLs, device/host identity, tool names, and URL/name inputs. Never for labels or prose.

The `label-soft` utility (`0.75rem`, weight 500, `+0.01em` tracking) is the label style — panel titles, form labels, `<dt>`s, empty-state messages. Tables get `tabular-nums` globally.

## Radius

- `rounded-xl` (12px) — panels, dialogs
- `rounded-lg` (8px) — buttons, inputs, nav items, empty states, telemetry grid frame
- `rounded-md` (6px) — badges, empty-state message pill
- `rounded-full` — chips, switch
- `rounded-[1px]` — the tiny square status dots (deliberately near-square, not round)

## Pixel motifs

- **Four-square cluster** — the mark: a 2×2 grid of amber squares fading corner to corner (`bg-amber`, `/40`, `/40`, `/15`). Appears at `size-1.5` in the header, `size-1` beside the page heading, and at `size-2` as the device indicator on the status page, where the squares light amber when the desk is connected and fall back to `bg-line` when not.
- **Dot grid** — the body background: 1px `linefaint` dots on a 26px grid over `ground`.
- **Pixelfield** — a denser texture (1.5px dots, 10px grid) via the `pixelfield` utility, used inside empty states and the offline device panel.

## Components

`src/blueprint/` — console-specific primitives:

- **Panel** — `rounded-xl border-line bg-panel`; optional 44px header with a `label-soft text-muted` title and a `meta` slot (usually a Chip).
- **Chip** — pill status indicator with a square dot. Tones: `live` (amber + 2s signal pulse), `busy` (ink + 1s pulse), `idle` (muted, static), `down` (faint, transparent fill).
- **Heading** — page title with the four-square mark and an optional muted description.
- **Empty** — dashed `border-line` box with pixelfield texture and a `label-soft text-faint` message on a `bg-panel` pill.

`src/components/ui/` — vendored shadcn-style primitives on Radix, restyled to the tokens:

- **Button** — variants `default` (solid amber, ground text), `outline`, `ghost`, `destructive` (danger text, transparent until hover); sizes `default` (h-9), `sm` (h-8), `lg` (h-11), `icon` (9×9).
- **Input** — h-9, `bg-ground`, `border-line`; hover `border-faint`, focus `border-amber`. No shadows or rings.
- **Label** — `label-soft text-muted`.
- **Badge** — variants `default`, `amber`, `danger`, `outline`. Static; a Chip is a Badge with a liveness dot.
- **Switch** — unchecked `border-line bg-raised` with a faint thumb; checked `border-amber bg-amberdim` with an amber thumb.
- **Dialog** — `bg-ground/80` overlay with 2px blur; content is a max-w-md panel (`rounded-xl border-line bg-panel p-6`) entering with `settle`.

## Motion

- `settle` — 0.45s ease-out-quint (cubic-bezier 0.16, 1, 0.3, 1) fade-up from 6px; applied to page roots and dialog content. The only entrance animation.
- `signal` — opacity pulse for chip dots; 2s on `live`, 1s on `busy`.
- Everything else is `transition-colors duration-150` (300ms for the device indicator squares). No scale, slide, or spring effects.
- A global `prefers-reduced-motion` guard collapses all animation and transition durations to 0.01ms.

## Layout

- Shell: a 56px sticky-feel header (`bg-panel/70 backdrop-blur-sm border-b`), then `lg:grid-cols-[12rem_1fr]` — side nav on desktop, horizontal scroll row on mobile. Main content is `p-4 lg:p-6`.
- Nav items: h-9 rounded-lg buttons with a square dot that turns amber when active; active state is `bg-raised text-ink`.
- Cell grids (agent facts, telemetry): `grid gap-px bg-line` with `bg-panel` cells — hairline separation from the gap showing through, not per-cell borders. Uneven rows get an `aria-hidden` filler cell so the grid stays closed.
- Panels compose with `space-y-5` vertically and `grid gap-4` for column splits.

## States

- **Loading** — plain muted text ("Waiting for state sync…", "Checking…"). No spinners or skeletons.
- **Empty** — the Empty component with a factual message ("No telemetry received yet").
- **Inline error** — `role="alert"`, `text-xs text-danger`, states what failed and what happens next ("Status poll failed — retrying every 10s.").
- **Banner error** — full-width `bg-dangerdim border-danger/40` strip under the header for connection-level failures.
- **Staleness** — shown honestly as faint text ("Snapshot 3 h ago — stale; …") rather than hidden.
- **Liveness** — Chip tones map agent `uiState`: listening/speaking → `live`, thinking/confirm/focus → `busy`, idle/dashboard → `idle`; unauthorized → `down`.

## Hard rules

- Dark only. `color-scheme: dark`, no light theme, no theme toggle.
- One accent. Amber for everything positive/active; danger red for errors; nothing else.
- Sentence case everywhere. No uppercase-tracked labels (`uppercase tracking-widest` is banned).
- No stacked echo headings and no hard 1px line-grid ornamentation — the rejected blueprint look.
- Elevation by border, not shadow. Surfaces step `ground → panel → raised`; no drop shadows anywhere.
- Mono is for data values only, never UI chrome.
- The dashboard secret is entered via `type="password"` and never rendered anywhere in the UI.
- Do not copy Cloudflare branding; the register is theirs, the identity is Apollo's.
