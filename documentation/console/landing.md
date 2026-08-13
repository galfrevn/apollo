# Landing

The marketing page for Apollo, served by the same assets-only Worker as the console: `/` is the landing and the console lives at path routes like `/console/device` (`src/router/route.ts`, history-based). Legacy hash bookmarks — `/#/device`, `/console#/device`, and the bare `/#/` — redirect to their path equivalents via `window.location.replace`. The split happens in `src/main.tsx` through `resolveSurfaceFromLocation` (`src/router/path.ts`); each surface loads through its own `React.lazy` boundary.

## Page

All code lives in `src/landing/`. Sections in order: hero (`hero.tsx`), 01 Listen (`showcase.tsx`), 02 Think (`architecture.tsx`), 03 Act (`capabilities/`), 04 Yours (`yours.tsx` — the ownership close: brain/body/console cards with the console CTA), footer (`footer.tsx`).

The positioning is "the brain for physical agentic devices": the worker is the brain, and the page speaks of bodies generically — the copy never names the ESP32. Typography follows the console system: sentence case everywhere, Hedvig Sans for UI text, mono reserved for code and data, sizes on the text-xs/text-sm scale. All claims stay factual — real paths, real bindings, no invented users or metrics.

All landing copy — every section, the conversation script, the capability rows, and the document title/description — lives in `src/landing/copy/` (`messages.ts` interface, `es.ts`, `en.ts`, `catalog.ts`), Spanish first with English via the nav toggle; `index.html` ships the Spanish static tags for crawlers and unfurlers. The catalog is imported only from `src/landing/`, so neither language's landing copy reaches the console chunk.

## The face

The living ASCII face is the brand mark animated: `face/geometry.ts` is a pure rasterizer (mark geometry, blink, pupil clamp, dither reveal — unit-tested), `face/emotions.ts` maps the four landing emotions to eye parameters, and `face/canvas.tsx` paints glyphs on a canvas driven by GSAP (blink timeline, `quickTo` pupil tracking, emotion morphs).

## Motion

GSAP is imported only under `src/landing/`, keeping it out of the console chunk. Every effect lives inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; reduced-motion visitors get a static face, default-visible markup, and native scrolling. Shared setup is in `motion.ts`, including `useSmoothScroll` — a ScrollSmoother instance (`smooth: 1`) over the `#smooth-wrapper`/`#smooth-content` pair in `page.tsx`; the fixed nav sits outside the smoothed content, and touch devices keep native scroll (ScrollSmoother's default).

The single landing-only exception to the console doctrine is the `#F5C518` speech accent on the reply label.

## Navigation

Prev: [Design](design.md) · Next: [Mapping](../reference/mapping.md)
