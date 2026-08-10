# Purpose

Apollo is a personal desk agent designed for an ESP32 device on your desk. The device captures gestures and audio; the Cloudflare Workers backend runs the agent loop, tools, memory, and speech pipeline.

## What it is

- A voice-first assistant tuned for short spoken replies
- A Durable Object–backed session that keeps desk state (UI mode, focus, preferences)
- A tool-using agent for weather, reminders, memory, research, translation, and sandboxed execution
- A protocol server for a constrained ESP32 client (JSON control messages plus audio)

## What it is not

- A general chat web app or dashboard product
- A metrics / DORA analytics system
- The firmware itself — that lives in `firmware/apollo-firmware`, a git submodule with its own handbook. This one covers the Workers side and the wire protocol the device speaks.

## Why ESP32

The product shape assumes a small always-on desk appliance: limited UI states, hold-to-talk style capture, gestures, and captions/TTS rather than a rich browser shell. The backend is built around that constraint.

## Navigation

Next: [Concepts](concepts.md)
