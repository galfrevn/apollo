# Making a First Documentation Change

Apollo keeps user-facing documentation under `documentation/` so that implementation notes and operational guidance can evolve alongside the code. A small documentation contribution is a useful way to learn the project before changing runtime behavior.

## Suggested workflow

Start by running the repository's documented checks locally and then choose one focused improvement: clarify a setup step, add a missing example, or correct a link. Keep the change narrowly scoped and preserve the existing Markdown style. If the change describes a command, verify the command against the current scripts before opening a pull request.

## Pull request checklist

A good documentation pull request explains the reader problem it solves, links the relevant page or code path, and states which checks were run. Screenshots are helpful for UI changes, while command output is helpful for setup or deployment changes. Avoid mixing unrelated formatting changes into the same pull request because they make review harder.

## Keeping examples safe

Examples should use placeholders for credentials, devices, and account identifiers. Do not copy private configuration into an issue or pull request. When an example depends on a local service, say so explicitly and describe the expected failure mode when that service is unavailable.
