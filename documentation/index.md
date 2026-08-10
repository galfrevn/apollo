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
7. [Face](runtime/face.md) — Emotion and accent color for the on-device screen

### Part III — Capabilities

8. [Tools](capabilities/tools.md) — Router and built-in catalog
9. [Memory](capabilities/memory.md) — Preferences, facts, and vectors
10. [Research](capabilities/research.md) — Quick search and deep research
11. [Weather](capabilities/weather.md) — Location, forecast, dashboard
12. [Focus](capabilities/focus.md) — Focus timer behavior
13. [Reminders](capabilities/reminders.md) — Schedules and delivery
14. [Sandbox](capabilities/sandbox.md) — Isolated code execution
15. [Coding](capabilities/coding.md) — Clone a repo, change it, open a pull request

### Part IV — Operations

16. [Setup](operations/setup.md) — Local development
17. [Deploy](operations/deploy.md) — Workers, bindings, and containers
18. [Auth](operations/auth.md) — Device shared secret
19. [Testing](operations/testing.md) — How this repo verifies behavior

### Part V — Reference

20. [Mapping](reference/mapping.md) — Handbook topics to `src/` folders
21. [Roadmap](reference/roadmap.md) — Confirmed work, proposals, and open ideas
