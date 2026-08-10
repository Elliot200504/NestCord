# Testing

Add useful tests. Do not chase a coverage number (PLAN.MD ss.27).

## Tooling

- **Vitest** — unit and integration tests, both apps.
- **Supertest** — NestJS HTTP endpoint tests.
- **Playwright** — a small set of end-to-end journeys.

## What must be tested

Backend:

- authentication (register, login, refresh, logout, session invalidation)
- permission resolution and guards, including administrator bypass and channel overrides
- message create / edit / delete, including "only the author may edit"
- server membership (join, leave, kick, ban)
- friend requests (send, accept, reject, block)

Frontend:

- login flow
- server/channel navigation
- message composer
- message rendering (markdown, mentions, grouping)

## What not to bother testing

Getters, straight pass-through controllers with no logic, styling, and generated Prisma client code.

## Style

- Arrange / Act / Assert, one behavior per test.
- Test names describe behavior: `rejects an edit from a user who is not the author`.
- Use factories or the seed helpers for fixtures rather than hand-written object literals repeated
  across files.
- Integration tests hit a real PostgreSQL test database; do not mock Prisma to test a query.
- Mock only true externals (filesystem for uploads, clock where timing matters).

## Bug fixes

A bug fix starts with a failing test that reproduces the bug. That test is the proof the fix works and
the guard against regression.
