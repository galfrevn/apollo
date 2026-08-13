# Testing

Tests run with Bun and live next to the code they cover as `__tests__/*.spec.ts`.

## Commands

```bash
bun test
bun run test:coverage
```

## Conventions

- Prefer focused unit tests around pure logic (protocol schemas, focus/reminder helpers, tool routers)
- Validate external-shaped payloads with Zod in production code; tests should exercise those parsers
- Keep tests deterministic — no live network unless a test explicitly opts into a mocked boundary

## Quality gates

Before considering a change done, `bun run check` should pass — it runs lint, format, typecheck, and test in one go. The pre-push hook runs typecheck and test as a backstop.

## Navigation

Prev: [Auth](auth.md) · Next: [Product](../console/product.md)
