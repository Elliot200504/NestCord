---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/tsconfig*.json"
---

# TypeScript Style

Extends [common/coding-style.md](../common/coding-style.md).

## Strict mode is mandatory

`strict: true` everywhere, plus `noUncheckedIndexedAccess`. Do not weaken compiler options to make an
error go away — fix the type.

- No `any`. If a type is genuinely unknown, use `unknown` and narrow it.
- No `@ts-ignore`. `@ts-expect-error` with a one-line reason is acceptable in rare, documented cases.
- No non-null assertions (`!`) on values that can actually be null — narrow instead.

## Types

- Prefer `type` aliases for unions and object shapes; use `interface` when declaration merging or
  class implementation is needed.
- Derive rather than duplicate: `type Message = Prisma.MessageGetPayload<...>` beats a hand-written
  mirror of the schema that will drift.
- Shared request/response shapes and permission flags live in `packages/shared` so the API and web
  agree by construction.
- Use `satisfies` to check an object against a type without widening it.

## Enums

Prefer string union types or `as const` objects over TS `enum`. Prisma enums are the exception — import
those from the generated client.

## Async

- `async`/`await` only; no raw `.then()` chains in application code.
- Every `await` that can reject is either inside a `try` or intentionally allowed to bubble to a
  NestJS exception filter / React error boundary.
- Never leave a floating promise; `void somePromise()` if the fire-and-forget is deliberate.

## Imports

- Use workspace aliases (`@nestcord/shared`, `@nestcord/database`) rather than deep relative paths.
- No circular imports between feature modules — extract the shared piece instead.
- `import type { ... }` for type-only imports.

## Formatting

Prettier owns formatting; ESLint owns correctness. Do not hand-format, and do not argue with the
formatter in review. Both run on every edit via the PostToolUse hook and must pass in `pnpm lint`.
