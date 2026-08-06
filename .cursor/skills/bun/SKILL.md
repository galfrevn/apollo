---
name: Bun
description: Use when building, running, testing, or bundling JavaScript/TypeScript applications. Reach for Bun when you need to execute scripts, manage dependencies, run tests, or bundle code for production. Bun is a drop-in replacement for Node.js with integrated package manager, test runner, and bundler.
metadata:
    mintlify-proj: bun
    version: "1.0"
---

# Bun Skill Reference

## Product Summary

Bun is an all-in-one JavaScript/TypeScript runtime and toolkit. It replaces Node.js, npm, Jest, and esbuild with a single fast executable. Bun runs TypeScript and JSX natively without configuration, starts 4x faster than Node.js, and includes a package manager (30x faster than npm), test runner (Jest-compatible), and bundler.

**Key files and commands:**
- `bunfig.toml` — Bun configuration (optional, in project root)
- `package.json` — Standard Node.js manifest; Bun reads it directly
- `bun run <file>` — Execute TypeScript/JavaScript files
- `bun install` — Install dependencies (creates `bun.lock`)
- `bun test` — Run tests (finds `*.test.ts`, `*.spec.ts`, etc.)
- `bun build` — Bundle code for production
- `bunx <package>` — Execute packages without installing

**Primary docs:** https://bun.com/docs

---

## When to Use

**Use this skill when:**
- Running TypeScript or JSX files directly without compilation
- Installing or managing npm packages faster than npm/yarn/pnpm
- Writing and running tests with a Jest-like API
- Bundling JavaScript/TypeScript for browsers or servers
- Building full-stack applications with HTML imports
- Executing package.json scripts with `bun run`
- Setting up a new project with `bun init`
- Deploying to production with `bun build`

**Do not use for:**
- Type checking (use `tsc` separately)
- Generating TypeScript type declarations
- Projects that require Node.js-specific APIs not yet in Bun (check compatibility)

---

## Quick Reference

### Essential Commands

| Task | Command |
|------|---------|
| Run a file | `bun run index.ts` or `bun index.ts` |
| Run a script | `bun run dev` (from `package.json` scripts) |
| Install deps | `bun install` |
| Add a package | `bun add react` |
| Add dev dep | `bun add -d @types/react` |
| Remove package | `bun remove react` |
| Run tests | `bun test` |
| Watch tests | `bun test --watch` |
| Bundle code | `bun build ./index.ts --outdir ./dist` |
| Watch bundler | `bun build ./index.ts --outdir ./dist --watch` |
| Execute package | `bunx cowsay "Hello"` |
| Initialize project | `bun init` |

### File Conventions

| Pattern | Meaning |
|---------|---------|
| `*.test.ts`, `*.test.js` | Test files (auto-discovered) |
| `*_test.ts`, `*_spec.ts` | Alternative test patterns |
| `bunfig.toml` | Bun configuration (optional) |
| `bun.lock` | Lockfile (text format, commit to git) |
| `.env` | Environment variables (auto-loaded) |

### Configuration in bunfig.toml

```toml
# Runtime
[serve]
port = 3000

[test]
root = "./__tests__"
coverage = true
timeout = 5000

[install]
optional = true
dev = true
production = false
linker = "hoisted"  # or "isolated"

[run]
shell = "system"
bun = true
silent = false
```

---

## Decision Guidance

### When to use `bun run` vs `bun <file>`

| Scenario | Use |
|----------|-----|
| Running a script from `package.json` | `bun run dev` |
| Running a file directly | `bun index.ts` or `bun run index.ts` |
| Running with Bun flags (watch, etc.) | `bun --watch run index.ts` |
| Running a system command | `bun run ls` (inside `package.json` script) |

### When to use `bun install` vs `bun add`

| Scenario | Use |
|----------|-----|
| Install all dependencies from `package.json` | `bun install` |
| Add a new package | `bun add react` |
| Add a dev dependency | `bun add -d typescript` |
| Install in production (no devDeps) | `bun install --production` |
| Frozen lockfile (CI/CD) | `bun install --frozen-lockfile` |

### When to use `hoisted` vs `isolated` linker

| Scenario | Use |
|----------|-----|
| Traditional npm behavior, shared `node_modules` | `hoisted` |
| Strict dependency isolation, prevent phantom deps | `isolated` |
| New workspaces/monorepos | `isolated` (default) |
| Existing projects | `hoisted` (default for backward compat) |

### When to bundle vs run directly

| Scenario | Use |
|----------|-----|
| Development, rapid iteration | `bun run` (no bundling) |
| Production server code | `bun build --target bun` |
| Browser/client code | `bun build --target browser` |
| Node.js compatibility | `bun build --target node` |
| Single executable | `bun build --target bun --outfile app` |

---

## Workflow

### 1. Start a New Project

```bash
bun init
# Choose template: Blank, React, or Library
cd my-app
bun run index.ts
```

### 2. Add Dependencies

```bash
bun add react react-dom
bun add -d typescript @types/react
```

### 3. Write and Run Code

```bash
# Edit index.ts with TypeScript/JSX
bun run index.ts

# Or watch for changes
bun --watch run index.ts
```

### 4. Write Tests

Create `math.test.ts`:
```ts
import { test, expect } from "bun:test";

test("2 + 2 = 4", () => {
  expect(2 + 2).toBe(4);
});
```

Run tests:
```bash
bun test
bun test --watch
bun test --coverage
```

### 5. Build for Production

```bash
# Bundle for browser
bun build ./src/index.tsx --outdir ./dist --target browser

# Bundle for server
bun build ./src/server.ts --outdir ./dist --target bun

# Create single executable
bun build ./src/server.ts --outfile app --target bun
```

### 6. Configure bunfig.toml (Optional)

```toml
[serve]
port = 8080

[test]
coverage = true
timeout = 10000

[install]
linker = "isolated"
```

### 7. Deploy

```bash
# Build for production
bun build ./src/server.ts --outdir ./dist --minify

# Run in production
bun ./dist/server.js
```

---

## Common Gotchas

- **TypeScript errors on `Bun` global:** Install `@types/bun` and configure `tsconfig.json` with `"lib": ["ESNext"]`
- **Lifecycle scripts don't run by default:** Add packages to `trustedDependencies` in `package.json` to allow `postinstall` scripts
- **`bun run` flags must come before the script name:** Use `bun --watch run dev`, not `bun run dev --watch`
- **Test files must match patterns:** Use `*.test.ts`, `*_test.ts`, `*.spec.ts`, or `*_spec.ts`
- **Environment variables auto-load from `.env`:** Disable with `env = false` in `bunfig.toml` if needed
- **`bun.lock` is text format:** Commit it to git; it's human-readable and mergeable
- **Peer dependencies install by default:** Unlike npm, Bun installs peerDependencies automatically
- **Node.js compatibility is ongoing:** Check [Node.js compat docs](/runtime/nodejs-compat) for unsupported APIs
- **Bundler doesn't type-check:** Run `tsc --noEmit` separately for type checking
- **Auto-install disabled in production:** Set `install.auto = "disable"` in `bunfig.toml` for CI/CD

---

## Verification Checklist

Before submitting work with Bun:

- [ ] Tests pass: `bun test` runs without errors
- [ ] No TypeScript errors: `bunx tsc --noEmit` (if using TypeScript)
- [ ] Code runs locally: `bun run index.ts` or `bun run dev`
- [ ] Dependencies are declared: `bun add <package>` (not manually edited `package.json`)
- [ ] `bun.lock` is committed (if using version control)
- [ ] `bunfig.toml` is configured for your use case (if needed)
- [ ] Build succeeds: `bun build ./src/index.ts --outdir ./dist`
- [ ] No console errors or warnings in output
- [ ] Environment variables are set (check `.env` or CI/CD config)
- [ ] Trusted dependencies are declared if using lifecycle scripts

---

## Resources

**Comprehensive navigation:** https://bun.com/docs/llms.txt

**Critical documentation pages:**
1. [Bun Runtime](/runtime) — Execute files and scripts
2. [Package Manager](/pm/cli/install) — Install and manage dependencies
3. [Test Runner](/test) — Write and run tests
4. [Bundler](/bundler) — Bundle code for production
5. [HTTP Server](/runtime/http/server) — Build servers with `Bun.serve`

---

> For additional documentation and navigation, see: https://bun.com/docs/llms.txt