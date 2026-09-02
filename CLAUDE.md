# NestCord

A Discord-inspired chat application built as a **small-scale learning project**. Full spec: [PLAN.MD](./PLAN.MD).

## The one rule that overrides everything

**This app serves a few hundred users. Do not build for millions.**

Favor: simple > clever, readable > abstract, working > over-engineered, feature-complete > enterprise-scale.

Explicitly **not** in this project — do not introduce any of these without the user asking first:
microservices, Redis, Kafka, RabbitMQ, Elasticsearch, Kubernetes, distributed workers, multiple API
instances, complicated caching layers, event sourcing, CQRS, an SFU for voice, Turborepo.

Layering rule: `Controller -> Service -> Prisma`. Do not insert facades, repositories, factories, or
providers between them unless a concrete problem demands it.

## Stack

| Layer    | Choice                                                                         |
| -------- | ------------------------------------------------------------------------------ |
| Monorepo | pnpm workspaces, TypeScript (strict), ESLint, Prettier                         |
| Backend  | NestJS, Prisma, PostgreSQL, Socket.IO, JWT, Argon2, class-validator, Swagger   |
| Frontend | React, Vite, TanStack Router, TanStack Query, Zustand, Tailwind, Radix, Lucide |
| Infra    | Docker Compose (PostgreSQL only); API and web run via pnpm in dev              |
| Testing  | Vitest, Supertest, Playwright                                                  |

## Layout

```text
apps/api/          NestJS API (auth, users, servers, channels, messages, roles,
                   friends, dms, attachments, notifications, admin, gateway,
                   health, config, common)
apps/web/          React + Vite (routes, components, features, api, hooks,
                   stores, websocket, lib, styles, test)
packages/database/ Prisma schema, migrations, seed
packages/shared/   Types, constants, permission flags shared by api and web
```

## Commands

```bash
docker compose up -d     # PostgreSQL only
pnpm install
pnpm dev                 # NestJS API + Vite web
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm db:generate | db:migrate | db:seed | db:reset
```

Use `pnpm`, never npm or yarn. Target a single package with `pnpm --filter @nestcord/api <script>`.

## Working agreements

1. Inspect the existing code before adding anything — reuse beats duplicating.
2. Keep features isolated; keep business logic in NestJS services and React components on UI.
3. Any schema change ships with a Prisma migration.
4. TypeScript strict must stay clean; `pnpm lint` must pass.
5. Never trust permissions sent by the frontend — authorize on the server, every time.
6. Never commit secrets. Add new variables to `.env.example` with placeholder values.
7. Follow the phase order in PLAN.MD ss.34 — foundation first, features after.

A feature is done when: schema + migration, API, authorization, UI, loading state, error handling,
realtime where required, tests for important behavior, clean typecheck, clean lint, working end to end
(PLAN.MD ss.36).

## Rules

Detailed rules live in `.claude/rules/`. Read the ones relevant to what you are touching:

- `rules/common/` — [coding style](.claude/rules/common/coding-style.md),
  [security](.claude/rules/common/security.md),
  [git workflow](.claude/rules/common/git-workflow.md),
  [development workflow](.claude/rules/common/development-workflow.md),
  [agents](.claude/rules/common/agents.md), [testing](.claude/rules/common/testing.md)
- `rules/typescript/` — [coding style](.claude/rules/typescript/coding-style.md)
- `rules/nestjs/` — [patterns](.claude/rules/nestjs/patterns.md),
  [security](.claude/rules/nestjs/security.md), [realtime](.claude/rules/nestjs/realtime.md),
  [prisma](.claude/rules/nestjs/prisma.md), [testing](.claude/rules/nestjs/testing.md)
- `rules/react/` — [patterns](.claude/rules/react/patterns.md),
  [state](.claude/rules/react/state.md), [testing](.claude/rules/react/testing.md)

## Skills and agents

Skills: `nestjs-patterns`, `react-patterns`, `permissions-model`, `realtime-events`,
`security-review`, `tdd-workflow`, `verification-loop`, `documentation-lookup`.

Agents: `planner`, `architect`, `code-reviewer`, `security-reviewer`, `doc-updater`.

Commands: `/commit-push-pr`, `/verify`.

## Documentation policy

Four documents, and no more: README.md (what the project is), SETUP.md (getting it running on a
clean machine), this file (how to work on it), and PLAN.MD (what gets built). Do not create dozens of
documentation files (PLAN.MD ss.32).
