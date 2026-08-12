# MCP servers

Everything in [Tools](tools.md) ships in the binary: adding a capability means writing a
definition, opening a pull request, and deploying. Installed MCP servers are the other
door. The owner connects an external Model Context Protocol server at runtime and picks
which of its tools Apollo may call — no deploy, no firmware flash.

Code lives under `src/mcp/`. Note that folder holds **two opposite directions**, and they
share nothing but a protocol name:

- `bridge.ts` — inbound. Apollo calls tools **on the firmware** over the device WebSocket
  (`set_volume`, `device_status`; see [Tools](tools.md)). Unchanged by any of this.
- everything else — outbound. Apollo is a **client** of servers on the internet.

## Installing

The `agents` SDK owns the connection, the handshake, and the credentials; Apollo owns the
policy. Installation goes through `@callable()` RPC on the Durable Object:

| Method | Does |
|--------|------|
| `installMcpServer` | `addMcpServer(name, url)`; returns `READY`, or `AUTHENTICATING` plus an `authUrl` |
| `uninstallMcpServer` | Closes the connection and drops the server's tool settings |
| `listMcpServers` | Every server with its discovered tools, enabled flag, and safety |
| `enableMcpTool` / `disableMcpTool` | Per-tool opt-in, with an optional safety override |

Server rows live in the SDK's own `cf_agents_mcp_servers` table. URLs must be absolute
`https` (`src/mcp/servers.ts`) — a relative one would resolve against the worker itself,
and plain `http` would carry the owner's token in clear.

For a server behind OAuth, `installMcpServer` returns an `authUrl` instead of connecting.
Opening it and completing the provider's login lands on
`/agents/apollo/<instance>/callback`, which the Agent base class handles on its own;
tokens are stored and refreshed by `DurableObjectOAuthClientProvider`. Nothing to paste,
nothing for Apollo to store. Servers that authenticate with a bearer token instead keep
that value in Durable Object storage next to the server row — never in Worker secrets,
which are for the platform keys in [Deploy](../operations/deploy.md).

## Tools are opt-in

A newly installed server contributes **nothing**. Its tools are discovered and listed, but
each one has to be enabled by name.

That is a deliberate cost. The built-in catalog is already 26 tools in every prompt; a
GitHub MCP alone would add roughly forty more, and a model choosing from seventy tools
picks worse than one choosing from thirty. On a device whose entire value is a fast,
correct spoken answer, that trade is not worth making silently. Enable the four tools you
actually want.

Enabled tools live in the `mcp_tool_settings` table (`src/mcp/settings.ts`), one row per
tool, holding the enabled flag and the safety level. Disabled tools are filtered out when
the turn's tool map is built, so they are neither advertised to the model nor callable.

## Naming

An installed tool reaches the model as `mcp_{serverId}_{toolName}` — the OpenAI function
schema only accepts `/^[A-Za-z0-9_]+$/` and caps names at 64 characters, so both segments
are sanitized and long names are truncated with a deterministic hash suffix
(`src/mcp/naming.ts`).

Nothing ever parses that name back apart. The handler closes over its `{serverId, toolName}`
when the map is built. What matters is that the name is a **pure function of its inputs**:
`pending_confirmations` stores it, and the confirm turn rebuilds the tool map from scratch
and looks the tool up by it. A random suffix would make every confirmed MCP call fail.

Built-in definitions are appended last, so an installed server can never capture a name the
persona prompt promises.

## Safety

MCP has no notion of danger, so Apollo supplies one: an installed tool is `unsafe` —
confirmation-gated, the same full-screen Sí/No as `sandbox_exec` — unless the server marks
it `readOnlyHint`, and never if it marks it `destructiveHint`. This is third-party code,
invoked by voice, that nobody reviewed. The owner can override per tool when a server
turns out to be trustworthy and chatty.

Two things installed tools do differently from built-ins, both on purpose:

- **Arguments are not validated locally.** A built-in tool's `buildConfirmSummary` doubles
  as the argument gate because it parses with the tool's own Zod schema. An MCP server's
  schema is its own; Apollo passes `inputSchema` through untouched and lets the server
  reject a bad call with `isError`.
- **The handler catches everything.** `executeToolByName` does not wrap `safe` handlers
  (`src/tools/router.ts`), so a thrown fetch error would fail the whole turn rather than
  the one call. A network failure has to come back as an ordinary tool error the model can
  narrate.

## Connections have roles

Adding a second kind of client broke an assumption the Durable Object had held since the
beginning: that every WebSocket connection is the ESP32. It is not, and the difference is
not cosmetic — an open browser tab counted as "the device is present" for the initiative
engine, and a binary frame from any connection was appended to the microphone buffer.

Connections are now tagged `device` or `dashboard` at connect time from the credential
they presented (`src/auth/role.ts`), and every broadcast addresses `getConnections('device')`.
The device is also excluded from the SDK's own protocol frames — state sync, MCP server
lists — which are not part of the Apollo protocol and which the firmware answers with an
error. See [Auth](../operations/auth.md).

## Prompt exposure

A server's tool descriptions are written by whoever runs that server and land in the system
prompt verbatim. That is prompt injection with the owner's own tools behind it. Apollo
length-caps the text and gates writes behind confirmation, which bounds the blast radius
without pretending to solve it. Install servers you would give a shell to.

## Navigation

Prev: [Coding](coding.md) · Next: [Setup](../operations/setup.md)
