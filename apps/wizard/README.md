<a id="readme-top"></a>

[![npm][npm-shield]][npm-url]
[![TypeScript][typescript-shield]][typescript-url]
[![Bun][bun-shield]][bun-url]
[![Cloudflare][cloudflare-shield]][cloudflare-url]

<br />
<div align="center">
  <img src="https://raw.githubusercontent.com/galfrevn/apollo/main/branding/banner.png" alt="Apollo banner" width="100%">

  <h3 align="center">create-heyapollo</h3>

  <p align="center">
    Scaffold your own Apollo, a personal agent with a body, on your Cloudflare account.
    <br />
    <br />
    <a href="https://heyapollo.dev"><strong>heyapollo.dev »</strong></a>
    <br />
    <br />
    <a href="https://github.com/galfrevn/apollo">Monorepo</a>
    ·
    <a href="https://github.com/galfrevn/apollo-firmware">Reference firmware</a>
  </p>
</div>

## Usage

```sh
bun create heyapollo
# or
npm create heyapollo
```

One command copies the Apollo starter into `apollo/` (or a name you pass), initializes git, installs dependencies, and hands you to the setup wizard. The template is embedded in this package: no network fetch, no repository cloning.

The scaffolded project requires [Bun](https://bun.sh) and a Cloudflare account. The Workers free plan covers everything except the optional coding sandbox.

## The wizard

Setup walks five short phases and ends with your agent deployed and answering:

1. **Cloudflare** confirms which account `wrangler` is logged into and probes that R2 is enabled before touching anything.
2. **Intelligence** takes your OpenRouter key and validates it live, including remaining credit.
3. **Voice** takes your ElevenLabs key and opens a voice picker built from the voices on your account.
4. **Extras** wires web search (Tavily) and email (Resend), both optional.
5. **Home** sets your city, timezone, and default weather location.

A recap shows everything before the launch, then the bootstrap provisions resources, uploads secrets, deploys the worker, and verifies a real device handshake against the live URL.

"No keys yet" is a first class answer. Trial mode deploys a fully protocol correct brain with zero external spend and mocked replies. Re-run `bun run setup` inside the project whenever you have real keys.

## What you get

The scaffold is intentionally minimal: the agent source, `wrangler.jsonc`, idempotent bootstrap scripts, and agent skills under `.claude/skills` that teach your coding agent Apollo's architecture and wire protocol. The full handbook stays in the [monorepo documentation](https://github.com/galfrevn/apollo/tree/main/documentation), which the skills link back to.

## Just the brain

What you scaffold is the brain alone: the Cloudflare Worker that listens, thinks, speaks, and remembers. No firmware is included. The bundled skills document the wire protocol end to end so your coding agent can adapt the firmware of your own device to it, and the [reference firmware](https://github.com/galfrevn/apollo-firmware) shows a complete ESP32 implementation.

## Flags

| Flag | Effect |
|:--|:--|
| `--no-install` | Skip `bun install` |
| `--no-setup` | Skip the wizard |
| `--no-git` | Skip `git init` |

Inside a scaffolded project, `bun run setup` re-opens the wizard at any time. It delegates to `bunx create-heyapollo@<version> setup`, pinned to the release that generated the scaffold so a rerun always matches your project.

## License

MIT. Source, issues, and documentation live in the [Apollo monorepo](https://github.com/galfrevn/apollo).

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
