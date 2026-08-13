# create-heyapollo

Scaffold your own [Apollo](https://heyapollo.dev) — a personal desk agent that lives on your Cloudflare Worker and talks to an ESP32 device (or any hardware you build).

```sh
bun create heyapollo
# or
npm create heyapollo
```

This copies the Apollo starter into `apollo/` (or a name you pass), initializes git, installs dependencies, and drops you into the interactive setup wizard: Cloudflare account confirmation, live API-key validation, an ElevenLabs voice picker, your city and timezone, then provision → deploy → a verified device handshake. "No keys yet" is a first-class answer (trial mode, zero external spend).

The scaffolded project requires [Bun](https://bun.sh). The Workers **free plan is enough** for everything except the optional coding sandbox.

Flags: `--no-install`, `--no-setup`, `--no-git`.

The template is embedded in this package — no network fetch, no repository cloning. Source, issues, and documentation: https://github.com/galfrevn/apollo
