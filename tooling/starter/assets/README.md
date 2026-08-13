# Apollo Starter

Your own Apollo: a personal desk agent that lives on a Cloudflare Worker and talks to an ESP32 device (or any hardware you build) over one WebSocket — voice turns, tools, memory, reminders, background research. This starter is the **brain**, generated from the [Apollo monorepo](https://github.com/galfrevn/apollo) with the author's personal values stripped out. You bring the body.

> Apollo speaks **Rioplatense Spanish** out of the box. Swapping language, voice, or region is a documented, mechanical change — see `.claude/skills/apollo-persona`.

## What you need

| Requirement | Notes |
|---|---|
| [Bun](https://bun.sh) | Runtime and package manager |
| A Cloudflare account | The **free plan is enough**: SQLite Durable Objects, R2 (needs a payment card on file), Vectorize, Queues, Workflows |
| An [OpenRouter](https://openrouter.ai) API key | Reasoning, transcription, embeddings — pay per use |
| An [ElevenLabs](https://elevenlabs.io) API key + a voice | Speech synthesis |
| — optional — [Tavily](https://tavily.com) | Web search tool |
| — optional — [Resend](https://resend.com) | Email reports to yourself |
| — optional — Workers Paid ($5/mo) + Docker | Only for the voice-to-PR coding sandbox opt-in |

No keys yet? Deploy in **trial mode** (`MOCK_VOICE=1`, preset in `.dev.vars.example`): a fully protocol-correct brain with mocked speech, zero external spend.

## The guided path: the setup wizard

```sh
bun install
bun run setup
```

An interactive wizard that confirms which Cloudflare account it's about to touch, validates every API key live before writing it, lets you **pick Apollo's voice from your own ElevenLabs library**, sets your city and timezone, then provisions, deploys, and verifies — ending at a live URL and a working device handshake. "No keys yet" is a first-class answer (trial mode, zero spend).

## The agent path

Open this folder with [Claude Code](https://claude.com/claude-code) (or any agent that reads `AGENTS.md`) and say:

> set this up for me

The `apollo-setup` skill walks the agent through the whole thing: a short interview, `.dev.vars` (you paste keys into the file — never into the chat), Cloudflare provisioning, deploy, and a verified first turn. Custom hardware? `apollo-firmware` + `apollo-protocol` let the agent write a client for whatever you've got — different board, no screen, a desktop app.

## The manual path

```sh
bun install
bunx wrangler login
cp .dev.vars.example .dev.vars     # fill in your keys (or keep MOCK_VOICE=1)
bun run bootstrap preflight        # confirms which Cloudflare account you're on
bun run bootstrap provision        # R2 buckets, Vectorize index (1536/cosine), queue
bun run bootstrap secrets          # generates shared secrets, pushes .dev.vars → worker secrets
bun run bootstrap deploy           # wrangler deploy → https://apollo.<you>.workers.dev
bun run bootstrap verify           # /health + a real device handshake probe
```

Then talk to it without any hardware:

```sh
bun run probe -- --url wss://apollo.<you>.workers.dev/agents/apollo/desk \
  --token <DEVICE_SHARED_SECRET from .dev.vars> --text "hola"
```

## Point a device at it

Any client that can hold a WebSocket, send 16 kHz PCM up, and play 24 kHz PCM down is a full citizen. The wire contract lives in `documentation/runtime/protocol.md` and `.claude/skills/apollo-protocol`.

- **Reference firmware** (Waveshare ESP32-S3 Touch LCD 1.85C V2): https://github.com/galfrevn/apollo-firmware — point it at `wss://<your-worker>/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`.
- **Your own hardware**: start from `.claude/skills/apollo-firmware` — a screenless speaker fully converses with ~6 message types.

## Manage it from a browser

The hosted console at **https://heyapollo.dev/console** connects directly to *your* worker: enter your worker URL, instance name `desk`, and your `DASHBOARD_SHARED_SECRET`. All three stay in your browser's local storage — nothing about your deployment is sent anywhere else.

## Where everything is

- `documentation/` — the handbook, meant to be read in order (`documentation/index.md`)
- `.claude/skills/` — task playbooks for coding agents: setup, protocol, firmware, persona, tooling, operations
- `src/configuration/identity.ts` — the owner seam: voice id, timezone, weather default, email sender
- `scripts/bootstrap.ts` / `scripts/probe.ts` — the only sanctioned way to provision, deploy, and verify

## License

MIT — see `LICENSE`. Generated from the Apollo monorepo; issues and contributions belong upstream at https://github.com/galfrevn/apollo.
