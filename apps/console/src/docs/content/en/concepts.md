Four words carry the rest of the handbook: desk, turn, session, and tool. Later chapters assume them, so they are defined once here.

![One bright sphere holding an orbit of seven smaller states on hairline rings](/handbook/concepts.jpg)

## The desk

A **desk** is one instance of the agent — a Durable Object named by the connection path. A device that connects to `/agents/apollo/desk` talks to the instance named `desk`.

That name is the identity. Each instance holds its own memory, preferences, and pending work, so two names are two different Apollos. `desk` is the convention the tooling assumes; you only invent more names when you run more than one desk.

The desk is also a small state machine. At any moment it is in exactly one mode:

`idle` · `listening` · `thinking` · `confirm` · `speaking` · `focus` · `dashboard`

The server pushes every transition to the device as a `ui_state` message, along with the caption, the face emotion, and the focus time remaining. The body never guesses what to render — it is told.

## Turns and sessions

A **turn** is one contribution processed end to end: you wake the device or hold to talk, audio streams to the worker, the reply comes back as speech. Inside the turn the server transcribes when needed, lets the model reason and call tools, and synthesizes the answer. [Loop](/docs/loop) walks through each step.

Turns accumulate into a **session** — the conversation thread the Durable Object keeps, with its own lifecycle of cutoff and recall. Consecutive turns share context without the thread growing forever.

Work too slow for a spoken exchange, like deep research or a coding task, leaves the interactive turn entirely and returns later as a `background_result`. The desk stays responsive in the meantime.

## Tools

A **tool** is a typed action the model can request instead of answering from memory: check the weather, set a reminder, remember a fact, start research.

Each tool declares its own safety level, and that field alone decides what happens next:

| Safety | What happens |
| --- | --- |
| `safe` | The tool runs immediately |
| `unsafe` | The device shows a summary with Sí/No buttons and waits for your answer before the side effect runs |

The built-in catalog is compiled into the worker. Servers you connect over MCP merge into the same map at runtime. [Capabilities](/docs/capabilities) covers both, and the doctrine behind the split.
