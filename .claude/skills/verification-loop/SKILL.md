---
name: verification-loop
description: Verification gate for NestCord — typecheck, lint, build, tests, database consistency, and the PLAN.MD definition-of-done checklist. Use before declaring a feature complete or opening a PR.
---

# Verification Loop

Run these in order. Stop at the first failure, fix it, restart from that phase. Report honestly —
never claim a phase passed that you did not run.

## Phase 1 — Types

```bash
pnpm typecheck 2>&1 | tail -30
```

Strict mode, zero errors. Fixing an error by adding `any`, `@ts-ignore`, or loosening `tsconfig` does
not count as fixing it.

## Phase 2 — Lint

```bash
pnpm lint 2>&1 | tail -30
```

Fix the code, not the rule. New ESLint disable comments need a stated reason.

## Phase 3 — Build

```bash
pnpm build 2>&1 | tail -30
```

Both `apps/api` and `apps/web` must build.

## Phase 4 — Tests

```bash
docker compose up -d          # PostgreSQL must be running for integration tests
pnpm test 2>&1 | tail -40
```

A skipped or filtered test suite is a failure to report, not a pass.

## Phase 5 — Database consistency

- `git status` on `packages/database/prisma/` — schema changed without a migration?
- Migrations committed?
- `pnpm db:seed` still runs against the current schema?

## Phase 6 — Runtime smoke test

```bash
pnpm dev
```

Then confirm by hand what the change actually touched: the API responds, the web app loads, the
feature works, and realtime events arrive (open two browser sessions when the feature is realtime).

## Phase 7 — Definition of done (PLAN.MD ss.36)

- [ ] Database change implemented with a migration
- [ ] API works
- [ ] Authorization enforced server-side
- [ ] Frontend UI exists
- [ ] Loading states exist
- [ ] Error handling exists
- [ ] Realtime behavior works where required
- [ ] Tests cover the important behavior
- [ ] TypeScript compiles, linting passes
- [ ] Works end to end

## Phase 8 — Hygiene

- [ ] No `console.log` or debugger left behind
- [ ] No commented-out code
- [ ] No secrets added; `.env.example` updated if new variables exist
- [ ] No stray documentation files created
- [ ] Nothing from the forbidden-tech list crept in

## Reporting

```markdown
## Verification

| Phase      | Result                             |
| ---------- | ---------------------------------- |
| Typecheck  | pass                               |
| Lint       | pass                               |
| Build      | pass                               |
| Tests      | 42 passed, 0 failed                |
| DB         | migration `20260810_add_reactions` |
| Smoke test | verified in two browser sessions   |

Not run: <anything skipped, and why>
```
