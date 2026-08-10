---
paths:
  - 'apps/api/**'
---

# API Testing

Extends [common/testing.md](../common/testing.md).

## Layers

- **Unit** — permission resolution, markdown/mention parsing, token helpers. Pure functions, no I/O,
  fast.
- **Integration** — service + real Prisma against a test PostgreSQL database. This is where most value
  is; do not mock Prisma to test a query.
- **HTTP** — Supertest against the Nest testing module for auth flows, guard behavior, and status
  codes.

## Database

Point tests at a separate database via `DATABASE_URL`. Migrate before the suite, truncate between
tests. Never run tests against the development database.

## Priorities

Cover the things that break accounts or leak data:

- register / login / refresh / logout, and refresh-token rotation
- guard rejects unauthenticated and unauthorized requests (403 vs 404 chosen deliberately)
- permission resolution: `@everyone`, role union, `ADMINISTRATOR` bypass, channel overrides, hierarchy
- message create/edit/delete authorization
- membership: join, leave, kick, ban, and that a banned user cannot rejoin
- friend request state transitions, including block

## Gateway tests

Test the gateway handler as a unit (does it authorize, does it emit to the right room) rather than
spinning up a real socket client for every case. Keep one end-to-end socket test for the happy path.
