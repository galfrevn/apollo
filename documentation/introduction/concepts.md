# Concepts

These terms show up throughout the handbook.

## Agent with a body

Apollo behaves like a companion in the room rather than a chat thread: idle until you wake or hold-to-talk, then it listens, thinks, optionally confirms a tool, speaks, and returns to idle or focus/dashboard modes.

## UI states

The device UI is a small state machine (`idle`, `listening`, `thinking`, `confirm`, `speaking`, `focus`, `dashboard`). The server pushes `ui_state` messages so the ESP32 can render the current mode, speech mode, caption, and focus remaining time.

## Turn

A turn is one user contribution (audio or text) processed into STT (when needed), model reasoning, optional tool calls, and a spoken/captioned reply.

## Session

Session state lives with the Apollo Durable Object: conversation memory, preferences, pending confirmations, and desk focus. It is not a stateless HTTP handler.

## Tools

Tools are typed actions the model can request (weather, remember fact, start research, and so on). A tool marked `unsafe` requires explicit user confirmation before its side effect runs — the machinery is in place, though no tool in the current catalog uses it (see [Tools](../capabilities/tools.md#confirmations)).

## Background work

Longer jobs (deep research, sandbox work) can leave the interactive turn and come back later as `background_result` or notifications, so the desk stays responsive.

## Navigation

Prev: [Purpose](purpose.md) · Next: [Loop](../runtime/loop.md)
