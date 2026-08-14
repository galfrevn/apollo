Apollo deploys from a single command. It scaffolds the starter — the brain with the author's personal values stripped out — initializes git, installs dependencies, and hands you to an interactive wizard that ends at a live worker and a verified device handshake. No keys yet is a first-class answer: trial mode deploys a fully protocol-correct brain with zero external spend.

![A terminal cursor sending one line of light toward distant infrastructure](/handbook/setup.jpg)

## What you need

- [Bun](https://bun.sh), the runtime and package manager.
- A Cloudflare account. The free plan is enough; R2 asks for a payment card on file even at zero cost.
- An [OpenRouter](https://openrouter.ai) API key for reasoning, transcription, and embeddings.
- An [ElevenLabs](https://elevenlabs.io) API key and a voice for speech synthesis.
- Optional: [Tavily](https://tavily.com) for web search, [Resend](https://resend.com) for email reports, and Workers Paid plus Docker only for the coding sandbox.

No keys yet? Deploy in trial mode (`MOCK_VOICE=1`, preset in `.dev.vars.example`): mocked speech, real everything else, zero spend.

## One command

```sh
bun create heyapollo
```

```sh
npm create heyapollo
```

The template is embedded in the package — no cloning, no network fetch. Pass a directory name to scaffold somewhere other than `apollo/`, and opt out of any step with `--no-install`, `--no-setup`, or `--no-git`. The wizard can be re-run any time from the project root with `bun run setup`.

## The wizard, phase by phase

- **Cloudflare account.** Logs you in through `wrangler` if needed, then shows exactly which account it is about to touch and asks before provisioning into it. It also checks that R2 is enabled.
- **API keys.** Choose real keys or trial mode. Real keys are validated live before anything is written, and Apollo's voice is picked from your own ElevenLabs library. Keys land in `.dev.vars`; shared secrets are generated for you.
- **Persona and location.** Your city sets the timezone and the weather default in `src/configuration/identity.ts`. The starter speaks Rioplatense Spanish by default; changing language, voice, or region is a guided task in `.claude/skills/apollo-persona`.
- **Deploy.** Provisions R2, Vectorize, and the queue, pushes secrets, deploys the worker, and verifies with a real device handshake. It ends by printing your worker URL, the device WebSocket address, and the console pointer.

## Or ask your agent

Open the scaffolded folder with [Claude Code](https://claude.com/claude-code) or any agent that reads `AGENTS.md` and say:

> set this up for me

The `apollo-setup` skill walks the agent through the whole flow. You paste keys into `.dev.vars` yourself; they never enter the chat.

## By hand

Every wizard step has a plain-script equivalent:

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

## First spoken turn

No hardware required — the probe script holds a device-grade WebSocket from your terminal:

```sh
bun run probe -- --url wss://apollo.<you>.workers.dev/agents/apollo/desk \
  --token <DEVICE_SHARED_SECRET from .dev.vars> --text "hola"
```

A physical device points at `wss://<your-worker>/agents/apollo/desk?token=<DEVICE_SHARED_SECRET>`; the wire contract lives in the Protocol chapter. To manage the deployment from a browser, the hosted console at [heyapollo.dev/console](https://heyapollo.dev/console) connects directly to your worker with the worker URL, the instance name `desk`, and your `DASHBOARD_SHARED_SECRET` — all three stay in your browser's local storage.
