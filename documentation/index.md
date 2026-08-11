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
14. [Timers](capabilities/timers.md) — Countdowns and pomodoros
15. [Lists](capabilities/lists.md) — Durable spoken lists
16. [Dollar rates](capabilities/rates.md) — Argentine dollar quotes
17. [Email](capabilities/email.md) — Reports and notes to the owner
18. [Sandbox](capabilities/sandbox.md) — Isolated code execution
19. [Coding](capabilities/coding.md) — Clone a repo, change it, open a pull request

### Part IV — Operations

20. [Setup](operations/setup.md) — Local development
21. [Deploy](operations/deploy.md) — Workers, bindings, secrets, and vars
22. [Auth](operations/auth.md) — Device shared secret
23. [Testing](operations/testing.md) — How this repo verifies behavior

### Part V — Reference

24. [Mapping](reference/mapping.md) — Handbook topics to `src/` folders
25. [Roadmap](reference/roadmap.md) — Confirmed work, proposals, and open ideas

### Part VI — Specification

26. [Apollo Device Protocol](specification/apollo-device-protocol.md) — The versioned wire contract any device can implement

## The firmware

The device side lives in `firmware/apollo-firmware`, a git submodule with its own
handbook. The contract between the two repos is [Protocol](runtime/protocol.md).
