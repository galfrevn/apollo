<a id="readme-top"></a>

[![npm][npm-shield]][npm-url]
[![TypeScript][typescript-shield]][typescript-url]
[![Bun][bun-shield]][bun-url]
[![Cloudflare][cloudflare-shield]][cloudflare-url]
[![Agents][agents-shield]][agents-url]
[![Zod][zod-shield]][zod-url]

<br />
<div align="center">
  <img src="https://raw.githubusercontent.com/galfrevn/apollo/main/branding/banner.png" alt="Apollo banner" width="100%">

  <h3 align="center">Apollo Starter</h3>

  <p align="center">
    Your own personal desk agent, on your Cloudflare account.
    <br />
    Voice turns, tools, memory, reminders, and background research for an ESP32 desk companion. You bring the body.
    <br />
    <br />
    <a href="https://github.com/galfrevn/apollo/tree/main/documentation"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://heyapollo.dev">heyapollo.dev</a>
    ·
    <a href="https://github.com/galfrevn/apollo">Upstream monorepo</a>
    ·
    <a href="https://github.com/galfrevn/apollo-firmware">Reference firmware</a>
  </p>
</div>

Fastest way in from nothing:

```sh
bun create heyapollo
```

This project is the brain, generated from the Apollo monorepo with the author's personal values stripped out. It speaks Rioplatense Spanish by default; changing the language, voice, or region is a guided task in `.claude/skills/apollo-persona`.

## What you need

| Requirement | Notes |
|:--|:--|
| [Bun](https://bun.sh) | Runtime and package manager |
| A Cloudflare account | The free plan is enough. R2 asks for a payment card on file even at zero cost |
| [OpenRouter](https://openrouter.ai) API key | Reasoning, transcription, embeddings, pay per use |
| [ElevenLabs](https://elevenlabs.io) API key + a voice | Speech synthesis |
| Optional: [Tavily](https://tavily.com) | Web search tool |
| Optional: [Resend](https://resend.com) | Email reports to yourself |
| Optional: Workers Paid + Docker | Only for the voice controlled coding sandbox |

No keys yet? Deploy in trial mode (`MOCK_VOICE=1`, preset in `.dev.vars.example`): a fully protocol correct brain with mocked speech and zero external spend.

## Three ways to set it up

### 1. The wizard

```sh
bun install
bun run setup
```

An interactive flow that confirms which Cloudflare account it is about to touch, validates every API key live before writing it, lets you pick Apollo's voice from your own ElevenLabs library, sets your city and timezone, then provisions, deploys, and verifies. It ends at a live URL and a working device handshake.

### 2. Your coding agent

Open this folder with [Claude Code](https://claude.com/claude-code) or any agent that reads `AGENTS.md` and say:

> set this up for me

The `apollo-setup` skill walks the agent through the whole thing. You paste keys into `.dev.vars`, never into the chat. Building for custom hardware? The `apollo-firmware` and `apollo-protocol` skills let the agent write a client for whatever you have, from a different board to a screenless speaker to a desktop app.

### 3. By hand

```sh
bun install
bunx wrangler login
cp .dev.vars.example .dev.vars     # fill in your keys, or keep MOCK_VOICE=1
bun run bootstrap preflight        # confirms which Cloudflare account you are on
bun run bootstrap provision        # R2 buckets, Vectorize index, queue
bun run bootstrap secrets          # generates shared secrets, pushes them to the worker
bun run bootstrap deploy           # wrangler deploy
bun run bootstrap verify           # /health plus a real device handshake probe
```

Then talk to it without any hardware:

```sh
bun run probe -- --url wss://apollo.<you>.workers.dev/agents/apollo/desk \
  --token <DEVICE_SHARED_SECRET from .dev.vars> --text "hola"
```

## Point a device at it

Any client that can hold a WebSocket, send 16 kHz PCM up, and play 24 kHz PCM down is a full citizen. The wire contract lives in `.claude/skills/apollo-protocol` and the [handbook](https://github.com/galfrevn/apollo/tree/main/documentation).

The [reference firmware](https://github.com/galfrevn/apollo-firmware) targets the Waveshare ESP32-S3 Touch LCD 1.85C V2. Point it at `wss://<your-worker>/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`. For your own hardware, start from `.claude/skills/apollo-firmware`: a screenless speaker fully converses with about six message types.

## Manage it from a browser

The hosted console at [heyapollo.dev/console](https://heyapollo.dev/console) connects directly to your worker. Enter your worker URL, instance name `desk`, and your `DASHBOARD_SHARED_SECRET`. All three stay in your browser's local storage; nothing about your deployment is sent anywhere else.

## Where everything is

| Place | Purpose |
|:--|:--|
| `.claude/skills/` | Task playbooks for coding agents: setup, protocol, firmware, persona, tooling, operations |
| `src/configuration/identity.ts` | The owner seam: voice id, timezone, weather default, email sender |
| `scripts/` | Bootstrap and probe, the only sanctioned way to provision, deploy, and verify |

## License

MIT. Generated from the [Apollo monorepo](https://github.com/galfrevn/apollo); issues and contributions belong upstream.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[npm-shield]: https://img.shields.io/npm/v/create-heyapollo?style=for-the-badge&logo=npm&logoColor=white&label=create-heyapollo&color=CB3837
[npm-url]: https://www.npmjs.com/package/create-heyapollo
[typescript-shield]: https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white
[typescript-url]: https://www.typescriptlang.org/
[bun-shield]: https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white
[bun-url]: https://bun.sh/
[cloudflare-shield]: https://img.shields.io/badge/Cloudflare-F38020?style=for-the-badge&logo=cloudflare&logoColor=white
[cloudflare-url]: https://workers.cloudflare.com/
[agents-shield]: https://img.shields.io/badge/Agents-0051C3?style=for-the-badge&logo=cloudflare&logoColor=white
[agents-url]: https://developers.cloudflare.com/agents/
[zod-shield]: https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white
[zod-url]: https://zod.dev/
