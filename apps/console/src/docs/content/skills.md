The scaffolded project ships its own manual as six agent skills under `.claude/skills/` — runbooks written for a coding agent rather than a human. Open the folder with [Claude Code](https://claude.com/claude-code) or any agent that reads `AGENTS.md`, and instead of reading documentation you delegate: the agent loads the right skill and operates Apollo for you.

## The six skills

| Skill | What it drives |
| --- | --- |
| `apollo-setup` | The from-zero deploy runbook: provisioning, secrets, identity edits, and a verified first spoken turn |
| `apollo-protocol` | The canonical wire contract — every message, audio framing, auth, the MCP bridge, OTA |
| `apollo-firmware` | Building a body for any hardware: which protocol subset to implement, in what order, and how to validate it against the simulator before hardware exists |
| `apollo-persona` | Identity, voice, language, and region — swap the ElevenLabs voice, leave Rioplatense Spanish, move the timezone and weather city, rename the assistant |
| `apollo-tooling` | Capabilities in and out: writing a new tool definition, the safe/unsafe doctrine, connecting MCP servers, enabling the coding sandbox |
| `apollo-operate` | Day-2 operations: debugging a live worker, publishing firmware over OTA, reading telemetry, cost ceilings, upgrading from an upstream snapshot |

Each skill encodes the doctrine along with the steps — `apollo-setup` knows the bootstrap scripts are the only sanctioned way to touch your Cloudflare account, `apollo-tooling` knows a tool earns `safe` by construction and never by prompt text — so the agent inherits the project's judgment, not just its commands.

## How a session works

The canonical first session is one sentence:

> set this up for me

The agent runs the same flow as the setup wizard — preflight, provisioning, secrets, deploy, verify — narrating as it goes. One rule is non-negotiable and the skill enforces it: **keys never enter the chat.** You paste API keys directly into `.dev.vars`, which is gitignored, and the agent works around that file rather than through it. If you try to paste a key at the agent, it will redirect you.

## Beyond setup

The same pattern covers the whole ownership arc. Ask for "make it speak Mexican Spanish" and `apollo-persona` maps every file the language lives in. Ask for "add a tool that checks my server status" and `apollo-tooling` walks the definition, the catalog, and the safety call. Ask for "publish this firmware build" and `apollo-operate` handles the R2 upload and the manifest in the right order. The skills are the reason the starter needs no long README: the manual is executable, and the agent is the one reading it.
