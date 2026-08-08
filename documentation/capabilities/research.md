# Research

Apollo distinguishes quick lookups from deep multi-source research.

## Quick search

`web_search` answers factual questions that need the open web without a long job. It runs on the Tavily API (`src/search/tavily.ts`, secret `TAVILY_API_KEY`, free tier ~1,000 searches/month) — results arrive with page content included, and `src/search/synthesize.ts` turns them into a short spoken answer with sources.

## Deep research

`start_research` enqueues a background workflow that makes a single call to Perplexity Sonar via OpenRouter (`src/search/deepresearch.ts`, model var `OPENROUTER_RESEARCH_MODEL`, default `perplexity/sonar-deep-research`). Sonar plans and runs its own multi-source searches and returns a cited markdown report; the workflow persists it to R2 and speaks a short summary as a `background_result`. Cost is pay-per-use (~USD 0.30–0.60 per research); if runs ever time out, `perplexity/sonar-reasoning-pro` is a faster config-only fallback.

The old homemade pipeline (Cloudflare `WEBSEARCH` binding + fetch/extract/synthesize) was removed: the binding is `account_disabled` on the free plan.

## When to use which

- Use quick search for “what’s the capital / latest score / one fact”
- Use deep research when the user wants a brief assembled from multiple sources

## Navigation

Prev: [Memory](memory.md) · Next: [Weather](weather.md)
