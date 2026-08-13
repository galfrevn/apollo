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
    Scaffold your own Apollo, a personal desk agent on your Cloudflare account.
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

One command copies the Apollo starter into `apollo/` (or a name you pass), initializes git, installs dependencies, and drops you into the interactive setup wizard: Cloudflare account confirmation, live API key validation, an ElevenLabs voice picker, your city and timezone, then provision, deploy, and a verified device handshake. "No keys yet" is a first class answer: trial mode deploys a fully protocol correct brain with zero external spend.

The scaffolded project requires [Bun](https://bun.sh). The Cloudflare Workers free plan is enough for everything except the optional coding sandbox.

## Just the brain

What you scaffold is the brain alone — the Cloudflare Worker that listens, thinks, speaks, and remembers. No firmware is included. Instead, the project ships agent skills (`.claude/skills`) that document Apollo's wire protocol end to end, so your coding agent can adapt the firmware of your own device to it — the [reference firmware](https://github.com/galfrevn/apollo-firmware) shows a complete ESP32 implementation.

## Flags

| Flag | Effect |
|:--|:--|
| `--no-install` | Skip `bun install` |
| `--no-setup` | Skip the wizard |
| `--no-git` | Skip `git init` |

The template is embedded in this package. No network fetch, no repository cloning.

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
