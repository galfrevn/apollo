# Apollo Handbook

Apollo is a personal desk agent designed for an ESP32 client, with a Cloudflare Workers backend that handles voice turns, tools, memory, and background work.

This handbook is meant to be read in order. Later chapters assume the concepts introduced earlier.

## Contents

### Part I — Introduction

1. [Purpose](introduction/purpose.md) — What Apollo is and is not
2. [Concepts](introduction/concepts.md) — Desk, turns, sessions, and tools

### Part II — Runtime

3. [Loop](runtime/loop.md) — How a request becomes a spoken reply
4. [Protocol](runtime/protocol.md) — Device ↔ server messages
5. [Voice](runtime/voice.md) — Speech in and speech out
6. [Persona](runtime/persona.md) — Soul prompt and speech modes

### Part III — Capabilities

7. [Tools](capabilities/tools.md) — Router and built-in catalog
8. [Memory](capabilities/memory.md) — Preferences, facts, and vectors
9. [Research](capabilities/research.md) — Quick search and deep research
10. [Weather](capabilities/weather.md) — Location, forecast, dashboard
11. [Focus](capabilities/focus.md) — Focus timer behavior
12. [Reminders](capabilities/reminders.md) — Schedules and delivery
13. [Sandbox](capabilities/sandbox.md) — Isolated code execution

### Part IV — Operations

14. [Setup](operations/setup.md) — Local development
15. [Deploy](operations/deploy.md) — Workers, bindings, and containers
16. [Auth](operations/auth.md) — Device shared secret
17. [Testing](operations/testing.md) — How this repo verifies behavior

### Part V — Reference

18. [Mapping](reference/mapping.md) — Handbook topics to `src/` folders
