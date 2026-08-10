---
allowed-tools: Bash(pnpm:*), Bash(git status:*), Bash(git diff:*), Read, Grep, Glob
description: Run the full verification gate before declaring work done
---

Run NestCord's verification gate and report honestly. Stop at the first failing phase, fix it, then
restart from that phase.

## Phase 1 — Types

```bash
pnpm typecheck 2>&1 | tail -30
```

(or `pnpm exec tsc --noEmit -p apps/api` and `-p apps/web` if no root script exists yet)

Strict mode is a project rule. Zero errors, no suppressions added to get there.

## Phase 2 — Lint

```bash
pnpm lint 2>&1 | tail -30
```

Fix the code, not the rule. Do not add ESLint disables to pass.

## Phase 3 — Build

```bash
pnpm build 2>&1 | tail -30
```

## Phase 4 — Tests

```bash
pnpm test 2>&1 | tail -40
```

If tests need the database, confirm `docker compose up -d` is running and migrations are applied.

## Phase 5 — Database consistency

- Does `schema.prisma` have uncommitted changes without a matching migration?
- Does the seed still run against the current schema?

## Phase 6 — Manual checklist against PLAN.MD ss.36

- [ ] Schema change has a migration
- [ ] API works and is authorized server-side
- [ ] Frontend UI exists, with loading and error states
- [ ] Realtime behavior works where the feature requires it
- [ ] Tests cover the important behavior
- [ ] No secrets added; `.env.example` updated if new variables exist
- [ ] No leftover debug logging

## Report

State plainly what passed, what failed with the actual output, and what you skipped and why. Do not
report success on a phase you did not run.
