A few words carry the whole handbook: the desk, a turn, a session, and a tool. Later chapters assume them, so they are defined once here.

## The desk

A desk is one instance of the agent — a Durable Object named by the connection path. A device that connects to `/agents/apollo/desk` talks to the instance named `desk`, and that name **is** the identity: each instance holds its own memory, preferences, and pending work, so two names are two different Apollos. `desk` is the convention the tooling assumes; you only invent more names when you run more than one desk.

The desk is also a small state machine. At any moment it is in one mode — `idle`, `listening`, `thinking`, `confirm`, `speaking`, `focus`, or `dashboard` — and the server pushes every transition to the device as a `ui_state` message, along with the caption, the face emotion, and the focus time remaining. The body never guesses what to render; it is told.

## Turns and sessions

A turn is one contribution processed end to end: you wake the device or hold to talk, audio streams to the worker, the reply comes back as speech. Inside the turn the server transcribes when needed, lets the model reason and call tools, and synthesizes the answer — the Loop chapter walks through each step.

Turns accumulate into a session: the conversation thread the Durable Object keeps, with its own lifecycle of cutoff and recall, so consecutive turns share context without the thread growing forever. Work too slow for a spoken exchange — deep research, a coding task — leaves the interactive turn entirely and returns later as a `background_result`, keeping the desk responsive in the meantime.

## Tools

Tools are typed actions the model can request instead of answering from memory: check the weather, set a reminder, remember a fact, start research. Each tool declares whether it is `safe` or `unsafe`; safe tools run immediately, unsafe ones put a summary and Sí/No buttons on the device screen and wait for your answer before the side effect runs. The built-in catalog is compiled into the worker, and servers you connect over MCP merge into the same map at runtime — the Capabilities chapter covers both, and the doctrine behind the safety split.
