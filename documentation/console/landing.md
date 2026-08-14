# Landing

The marketing page for Apollo, served by the same assets-only Worker as the console: `/` is the landing and the console lives at path routes like `/console/device` (`src/router/route.ts`, history-based). Legacy hash bookmarks — `/#/device`, `/console#/device`, and the bare `/#/` — redirect to their path equivalents via `window.location.replace`. The split happens in `src/main.tsx` through `resolveSurfaceFromLocation` (`src/router/path.ts`); each surface loads through its own `React.lazy` boundary.

## Page

All code lives in `src/landing/`. Sections in order: hero (`hero.tsx`), 01 Listen (`showcase.tsx`), 02 Think (`architecture.tsx`), 03 Act (`capabilities/`), 04 Yours (`yours.tsx` — the ownership close: brain/body/console cards with the console CTA), footer (`footer.tsx`).

The positioning is "the brain for physical agents": the worker is the brain, the reader supplies the body, and the page speaks of bodies generically — the copy never names the ESP32. The wake word is presented as the reader's choice rather than a fixed product name, and the provider is named once, in the architecture section, because the brain is meant to outlive that choice. Typography follows the console system: sentence case everywhere, Hedvig Sans for UI text, mono reserved for code and data, sizes on the text-xs/text-sm scale. All claims stay factual — real paths, real bindings, no invented users or metrics.

All landing copy — every section, the conversation script, the capability rows, and the document title/description — lives in `src/landing/copy/` (`messages.ts` for the interface, `text.ts` for the values). The surface is English only; `index.html` ships those same strings as static tags for crawlers and unfurlers. `text.ts` is imported only from `src/landing/`, so landing copy never reaches the console chunk.

## Discovery

The landing serves one crawlable URL, `/`. It ships a full head — self-canonical, complete Open Graph and Twitter cards, theme color, manifest — plus JSON-LD (`WebSite`, `SoftwareApplication`, `Person`) whose description and feature list must match `text.ts` verbatim. The retired `/en` URL is a 301 to `/` through `public/_redirects`.

Crawlers see real content without JavaScript: `scripts/discovery.ts` runs after `vite build` and injects a semantic static block (nav, h1 hero, four h2 sections, h3 capability and ownership lists, footer) between the `<!-- landing-static -->` markers inside `#root`, rendered from `src/landing/static.ts` off the copy catalogs. The same script emits noindexed console shells (`dist/console.html` plus one per route in `CONSOLE_ROUTE_LIST`) with the landing block stripped. `src/main.tsx` mounts React only after the surface module resolves, so the static markup stays visible until hydration replaces it.

Crawl control lives in `public/`: `robots.txt` (AI crawlers explicitly allowed, `/console` disallowed), `sitemap.xml`, `llms.txt` (a summary for language models), `site.webmanifest`, and `404.html` — `wrangler.jsonc` uses `not_found_handling: "404-page"`, so unknown paths return real 404s instead of the app shell. The public origin is pinned in `src/landing/origin.ts`; `src/landing/__tests__/discovery.spec.ts` welds the template, the generated documents, and every crawl file to the catalogs and that constant, so a future domain migration starts by changing `LANDING_PUBLIC_ORIGIN` and following the failing assertions.

## The face

The living ASCII face is the brand mark animated: `face/geometry.ts` is a pure rasterizer (mark geometry, blink, pupil clamp, dither reveal — unit-tested), `face/emotions.ts` maps the four landing emotions to eye parameters, and `face/canvas.tsx` paints glyphs on a canvas driven by GSAP (blink timeline, `quickTo` pupil tracking, emotion morphs).

## Motion

GSAP is imported only under `src/landing/`, keeping it out of the console chunk. Every effect lives inside `gsap.matchMedia('(prefers-reduced-motion: no-preference)')`; reduced-motion visitors get a static face, default-visible markup, and native scrolling. Shared setup is in `motion.ts`, including `useSmoothScroll` — a ScrollSmoother instance (`smooth: 1`) over the `#smooth-wrapper`/`#smooth-content` pair in `page.tsx`; the fixed nav sits outside the smoothed content, and touch devices keep native scroll (ScrollSmoother's default).

The single landing-only exception to the console doctrine is the `#F5C518` speech accent on the reply label.

## Navigation

Prev: [Design](design.md) · Next: [Mapping](../reference/mapping.md)
