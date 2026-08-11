# Coding

Apollo can clone a GitHub repository, change it, run its tests, and open a pull request — by voice.

## The shape of a run

`start_coding_task` is `unsafe`, so one spoken confirmation authorizes the whole task; confirming every `git` and `npm` command by voice would be unusable. The handler only enqueues, so nothing starts before you approve. The job goes to the `apollo-coding` Workflow (`src/workflows/coding.ts`), which:

1. Mints a GitHub App installation token and reads the default branch.
2. Clones fresh into `/workspace/repo` in the agent sandbox.
3. Runs the agent loop (`src/coding/agent.ts`) with four tools: `list_files`, `read_file`, `write_file`, `run_command`.
4. Extracts the agent's changes as a binary patch — no token involved.
5. In a second, fresh sandbox: clones again, cuts an `apollo/<slug>-<id>` branch, applies the patch, commits as the bot, pushes, and opens the pull request.
6. Destroys both sandboxes.

The result comes back through the same path as deep research: a short spoken summary, the full run log in R2, and a `background_result` on the wire.

## Naming a repository by voice

Nobody dictates `owner/repo` out loud, so the tool accepts the name however the
user says it — "apollo", "apollo firmware" — and resolves it against the App's
installation list (`resolveSpokenRepositoryReference`, `src/github/repository.ts`),
ignoring case and separators. An exact name wins over a containment; an ambiguous
name comes back as a spoken question listing the candidates, and an unknown one
lists what is available instead of asking for a URL. A reference that already
parses as `owner/repo` or a GitHub URL skips the lookup entirely. The agent can
also enumerate the options with `list_coding_repositories` — the same
installation list that acts as the allowlist, read through the App credentials
(`listGithubAppRepositoryFullNameList`, `src/github/app.ts`).

## Why the sandbox is disposable

Container disk is ephemeral — when an instance sleeps, it restarts with a fresh disk from the image. So there is nowhere to "leave work in progress": **the git remote is the source of truth**. Every run clones from scratch and ends in a pushed branch. The sandbox runs with `keepAlive` so a 10-minute sleep cannot wipe the workspace mid-run, and is destroyed at the end because billing runs while it is alive.

## Identity

Commits and pull requests are authored by the GitHub App's bot, not by you, so Apollo's work is distinguishable from yours in `git log`. The identity is derived from the App at run time, not configured: `<slug>[bot]`, where the slug comes from `GET /app`, with a `<bot-user-id>+<slug>[bot]@users.noreply.github.com` address. So an App named "Apollo Desk" commits as `apollo-desk[bot]`. The id is the bot user's, not the App ID.

Installation tokens last an hour, so one is minted immediately before the push rather than reused from clone time.

## What bounds it

- **Repository scope** is the App's installation list. A repository it was not installed on fails at `GET /repos/{owner}/{repo}/installation`, before a container boots or a model token is spent.
- **The base branch is never a push target.** Work always lands on a new branch, and `createGithubPullRequest` refuses a head equal to the base.
- **The agent cannot leave the repository.** `resolveWorkspaceFilePath` rejects `..` escapes and any path under `.git`.
- **The agent cannot see the token.** Its sandbox port has no way to pass environment variables, and git receives the token through a credential helper reading the environment — never through `argv` or the remote URL. Output is redacted on the way out regardless.
- **The agent cannot ambush the push.** After the clone, no token-carrying command runs in the sandbox the agent has a shell in. The changes leave it as a patch, and the authenticated push happens in a fresh sandbox where the patch is inert data — `git apply` refuses paths outside the worktree and under `.git` — so a planted hook, a repointed `origin`, a rewritten `.git/config`, or a replaced `git` binary never meets the token.
- **The loop is bounded** by a round cap, so a confused model stops instead of burning tokens.

## Configuration

| Setting | Purpose |
|---------|---------|
| `GITHUB_APP_ID` | Secret — the App's numeric id |
| `GITHUB_APP_PRIVATE_KEY` | Secret — PKCS#8 PEM. Convert a PKCS#1 key with `openssl pkcs8 -topk8 -nocrypt` |
| `OPENROUTER_CODING_MODEL` | Var, default `moonshotai/kimi-k3` |
| `instance_type` | `standard-1` — `lite` cannot hold a clone plus an install |

Create the App with **Contents: read & write**, **Pull requests: read & write**, **Metadata: read**, then install it on the repositories Apollo may touch.

## Navigation

Prev: [Sandbox](sandbox.md) · Next: [Setup](../operations/setup.md)
