---
name: tdd-workflow
description: Pragmatic test-first workflow for NestCord using Vitest, Supertest, and Playwright. Use when implementing features or fixing bugs in behavior that matters (auth, permissions, messaging, membership).
---

# Test Workflow (NestCord)

PLAN.MD ss.27: add **useful** tests, do not chase coverage. Test-first for the behavior that would hurt
if it broke; write the code directly for the rest.

## When to write the test first

Always, for:

- authentication and session handling
- permission resolution and guards
- message create / edit / delete authorization
- server membership, kick, ban
- friend request state transitions
- any bug fix (the failing test is the proof and the regression guard)

Skip the ceremony for: styling, layout, pass-through controllers, generated code.

## The loop

**RED** — write a test that states the behavior and fails for the right reason.

```ts
it('rejects an edit from a user who is not the author', async () => {
  const { message, otherUser } = await seedMessage();
  await expect(service.update(message.id, otherUser.id, { content: 'hacked' })).rejects.toThrow(
    ForbiddenException,
  );
});
```

Run it. If it passes, the test is wrong.

**GREEN** — the simplest implementation that passes. No extra abstraction "while you are in there".

**REFACTOR** — clean up with the test as the safety net. Behavior unchanged, tests still green.

## Layers

| Layer       | Tool             | Use for                                            |
| ----------- | ---------------- | -------------------------------------------------- |
| Unit        | Vitest           | permission math, markdown/mention parsing, helpers |
| Integration | Vitest + Prisma  | services against a real test database              |
| HTTP        | Supertest + Nest | auth flows, guards, status codes                   |
| Component   | Vitest + RTL     | composer, message rendering, permission-driven UI  |
| E2E         | Playwright       | login, navigate, send a message, friends page      |

Do not mock Prisma to test a query — use a test database. Mock only true externals.

## Database setup for tests

Separate `DATABASE_URL`, migrate before the suite, truncate between tests. Never point tests at the
development database.

## Naming

Describe behavior, not implementation:

```text
✅ 'grants all permissions to the server owner'
✅ 'expires a refresh token after it has been rotated'
❌ 'test update method'
```

## Fixtures

Factories or seed helpers, not copy-pasted object literals. Each test creates the state it needs and
does not depend on another test's leftovers.

## Definition of done for a tested feature

- [ ] Happy path covered
- [ ] The authorization failure path covered
- [ ] One edge case that actually occurs (empty channel, deleted parent message, self-friend-request)
- [ ] `pnpm test` green, `pnpm typecheck` green, `pnpm lint` green
