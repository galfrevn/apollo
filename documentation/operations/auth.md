# Auth

Two kinds of client reach the agent, and each presents its own shared secret as a URL
`token` query parameter. Both are compared with the same timing-safe byte compare
(`apps/agent/src/auth/token.ts`); what differs is which secret matches, and what that buys.

| Role | Secret | Is |
|------|--------|-----|
| `device` | `DEVICE_SHARED_SECRET` | The ESP32. Sends microphone audio, receives TTS and every protocol frame. |
| `dashboard` | `DASHBOARD_SHARED_SECRET` | A browser. May install MCP servers; is never sent audio. |

They are deliberately not the same secret. The device credential is compiled into the
firmware, so rotating it costs an OTA; a browser credential lives in a tab. Sharing one
would mean a leaked dashboard compromises the device, and every rotation reflashes the
fleet.

## Flow

1. The client opens the agent connection URL including `?token=...`
2. `resolveApolloConnectionRole` tries the device secret, then the dashboard secret
   (`apps/agent/src/auth/role.ts`)
3. Neither matching rejects the connection before the desk session starts
4. `getConnectionTags` re-derives the same role inside the Durable Object and tags the
   connection with it

## Why the role is re-derived

The worker's `onBeforeConnect` runs before the Durable Object wakes and can only allow or
deny — it cannot tell the object *why* a connection was allowed. Rather than pass a header
the object would have to trust, `getConnectionTags` runs the same pure resolution again
against the connection's own request. There is no channel to spoof.

## What the tag decides

Every server-to-device broadcast addresses `getConnections(DEVICE_CONNECTION_TAG)`: TTS
audio, `ui_state`, earcons, MCP JSON-RPC to the firmware, and the connection count the
initiative engine reads to decide whether anyone is at the desk. Binary frames are only
accepted from the device, because a binary frame is microphone audio by definition and one
from anywhere else would be transcribed into the owner's next sentence.

`onConnect` is device-only for the same reason, and one sharper one: it replays desk
session state to the arriving client, and the pending-message flush **consumes** what it
sends. A dashboard taking that path would swallow a reminder queued while the device was
offline — sent to a browser that cannot speak it, and deleted from the table before the
device ever reconnected. It would also stamp the browser's own origin over the one the OTA
push hands the device as a firmware URL.

`onMessage` is device-only in the other direction. Every inbound type is device vocabulary:
mic audio, the listen state machine, telemetry that steers the OTA push and the low-battery
announcement, `mcp` replies that resolve a pending device tool call, and `confirm` answers
to a prompt on the device's own screen. Honouring any of it from a browser would let a tab
desynchronize the desk. The dashboard loses nothing by it — the SDK dispatches `@callable`
RPC and state sync before `onMessage` runs, so both still reach it.

The device is also excluded from the SDK's own protocol frames — agent state sync, MCP
server lists — which are not part of the [Protocol](../runtime/protocol.md) and which the
firmware answers with an error.

## RPC

The SDK gives a `@callable()` method no way to identify the connection that invoked it, so
the MCP management methods take the dashboard secret in their payload and re-check it
(`apps/agent/src/agents/apollo.ts`). Connect-time authorization alone would let anything holding a
socket install a server and grant itself tools.

## Operational notes

- Rotate `DEVICE_SHARED_SECRET` in Worker secrets when a device is lost; it needs a
  firmware rebuild, so treat it as a fleet operation
- Rotate `DASHBOARD_SHARED_SECRET` freely — nothing but a browser holds it
- Do not log raw tokens
- Protocol `hello.deviceId` identifies the device after auth; it is not a substitute for
  the shared secret
- Cloudflare Access is the natural replacement for the dashboard secret. It would swap out
  `resolveApolloConnectionRole` and nothing else

## Navigation

Prev: [Deploy](deploy.md) · Next: [Testing](testing.md)
