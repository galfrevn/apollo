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
10. [Threads](capabilities/threads.md) — Conversation lifecycle, cutoff, and recall
11. [Research](capabilities/research.md) — Quick search and deep research
12. [Weather](capabilities/weather.md) — Location, forecast, dashboard
13. [Focus](capabilities/focus.md) — Focus timer behavior
14. [Reminders](capabilities/reminders.md) — Schedules and delivery
15. [Timers](capabilities/timers.md) — Countdowns and pomodoros
16. [Broadcast](capabilities/broadcast.md) — Owner messages spoken through the desk, typed or recorded
17. [Lists](capabilities/lists.md) — Durable spoken lists
18. [Dollar rates](capabilities/rates.md) — Argentine dollar quotes
19. [Email](capabilities/email.md) — Reports and notes to the owner
20. [Sandbox](capabilities/sandbox.md) — Isolated code execution
21. [Coding](capabilities/coding.md) — Clone a repo, change it, open a pull request
22. [MCP servers](capabilities/mcp.md) — Connect external tools at runtime

### Part IV — Operations

23. [Setup](operations/setup.md) — Local development
24. [Deploy](operations/deploy.md) — Workers, bindings, secrets, and vars
25. [Auth](operations/auth.md) — Device and dashboard credentials
26. [Testing](operations/testing.md) — How this repo verifies behavior

### Part V — Console

27. [Product](console/product.md) — What the console is for and who it serves
28. [Design](console/design.md) — The console's visual system, documented from the code as built
29. [Landing](console/landing.md) — The marketing landing at `/`, its narrative, pixel face, and motion policy

### Part VI — Reference

30. [Mapping](reference/mapping.md) — Handbook topics to `apps/agent/src/` folders
31. [Roadmap](reference/roadmap.md) — Confirmed work, proposals, and open ideas
32. [Starter](reference/starter.md) — How the public `apollo-starter` snapshot is generated and released

## The firmware

The device side lives in `apps/firmware/apollo-firmware`, a git submodule with its own
handbook. The contract between the two repos is [Protocol](runtime/protocol.md).
