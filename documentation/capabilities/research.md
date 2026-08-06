# Research

Apollo distinguishes quick lookups from deep multi-source research.

## Quick search

`web_search` answers factual questions that need the open web without a long job. Implementation touches `src/tools/web.ts` and search helpers under `src/search/`.

## Deep research

`start_research` kicks off a longer pipeline (fetch, extract, synthesize) that should complete in the background and return as a `background_result` the device can surface later.

## When to use which

- Use quick search for “what’s the capital / latest score / one fact”
- Use deep research when the user wants a brief assembled from multiple sources

## Navigation

Prev: [Memory](memory.md) · Next: [Weather](weather.md)
