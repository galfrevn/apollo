The console at [heyapollo.dev/console](https://heyapollo.dev/console) is the instrument panel around the desk: a browser view of what your agent knows, sees, and plans. It connects straight from your browser to your own worker — the hosted page is static, stores nothing server-side, and never sees your data.

## Connecting

Three values identify a desk:

- **Worker URL** — where your brain lives, `https://apollo.<you>.workers.dev` or your custom domain.
- **Instance name** — the desk's identity, `desk` unless you chose otherwise. It must match exactly; a different name is a different, empty Apollo.
- **Dashboard secret** — the `DASHBOARD_SHARED_SECRET` that bootstrap generated into `.dev.vars`.

All three stay in your browser's local storage. The console opens a WebSocket directly to your worker, authenticates with the secret, and everything it shows arrives live from there — losing the browser loses nothing but a saved connection.

![The connect screen asking for a worker URL, a device name, and the dashboard secret](/handbook/console/connect.jpg)

## What you can do

The console is read-and-RPC only: it explains the agent's internal state and issues explicit commands, but it can never take the device's place on the protocol.

![The status overview greeting the desk, with telemetry cards for device, agent, battery, signal, reminders, and firmware](/handbook/console/status.jpg)

- **Live status.** The current UI mode, whether the device is connected, and the latest telemetry snapshot — battery, charging, volume, signal, firmware version — shown with honest staleness, since telemetry only flows while the device is online.
- **Memory.** Browse what Apollo remembers: raw memories, the consolidated owner-memory block, and the spoken lists, so you can trust what it knows instead of guessing.
- **Schedules.** View and cancel pending reminders and timers.
- **MCP servers.** Install and remove servers, complete their OAuth flows, and enable tools one by one with their safety levels — the management half of the Capabilities chapter.
- **Broadcast.** Speak through the desk from anywhere: type a phrase for Apollo to say with its own voice, or record audio that plays as-is. Broadcasts queue while the device is offline and deliver on reconnect.

![The MCP panel showing an installed server and a list of one-click connectors](/handbook/console/mcp.jpg)

## Two secrets by design

The console authenticates with the dashboard secret, never the device one, and the split is deliberate. The device credential is compiled into firmware — rotating it means reflashing or an OTA for every body you own — while the dashboard credential lives in a browser tab and rotates freely with one `wrangler secret put`. Sharing one secret would mean a leaked browser tab compromises the device fleet.

The roles differ in kind, not just in privilege: dashboard connections are never sent audio, cannot inject microphone frames, and are excluded from the device's message path entirely, so an open tab can never desynchronize the desk. Sensitive RPCs re-check the secret inside their payload rather than trusting the connection alone.
