# NestCord

A Discord-inspired chat application built with NestJS and React, as a learning project.

It is deliberately scoped for **a few hundred users**: one API process, one PostgreSQL database,
in-memory presence, and local file storage. No Redis, no microservices, no message brokers.
The full specification lives in [PLAN.MD](./PLAN.MD).

## Status

Foundation complete — the monorepo, database schema, API skeleton and UI shell run end to end.
Authentication, servers, channels, messaging and realtime are built in the phases listed in
PLAN.MD §34.

## Technology stack

| Layer    | Choice                                                                               |
| -------- | ------------------------------------------------------------------------------------ |
| Monorepo | pnpm workspaces, TypeScript (strict), ESLint, Prettier                               |
| Backend  | NestJS 11, Prisma 7, PostgreSQL 17, Socket.IO, JWT, Argon2, class-validator, Swagger |
| Frontend | React 19, Vite 8, TanStack Router, TanStack Query, Zustand, Tailwind 4, Radix UI     |
| Testing  | Vitest, Supertest, Playwright                                                        |

## Requirements

- Node.js 20.19+, 22.12+ or 24+ (Prisma does not support odd-numbered releases)
- pnpm 11+ (`npm install -g pnpm`)
- Docker, for PostgreSQL

## Installation

```bash
git clone https://github.com/Elliot200504/NestCord.git
cd NestCord
pnpm install

cp .env.example .env
# generate two secrets and paste them into .env
openssl rand -base64 48
```

## Environment variables

All variables live in a single `.env` at the repository root. The API validates them at startup and
refuses to boot if any are missing or malformed.

| Variable                                   | Purpose                                            |
| ------------------------------------------ | -------------------------------------------------- |
| `DATABASE_URL`                             | PostgreSQL connection string                       |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets, 32+ characters each         |
| `JWT_ACCESS_TTL` / `JWT_REFRESH_TTL`       | Token lifetimes (default `15m` / `30d`)            |
| `API_PORT`, `API_URL`, `WEB_URL`           | Ports and origins; `WEB_URL` is the CORS allowlist |
| `UPLOAD_DIR`, `UPLOAD_MAX_BYTES`           | Local attachment storage                           |
| `VITE_API_URL`                             | API origin the Vite dev proxy targets              |

Never commit `.env`. Add new variables to `.env.example` with a placeholder.

## Database setup

```bash
docker compose up -d    # PostgreSQL on localhost:5432
pnpm db:migrate         # apply migrations
pnpm db:seed            # 10 users, 3 servers, channels, messages, friends, DMs
```

The seed creates a development account:

```text
test@nestcord.local  /  password123
```

## Development

```bash
pnpm dev
```

- Web app — http://localhost:5173
- API — http://localhost:3000/api
- Swagger — http://localhost:3000/api/docs

`pnpm dev` builds the internal packages first, then runs the API and the web app together. Requests
to `/api` are proxied from Vite to NestJS, so the browser stays on one origin.

## Commands

| Command           | Purpose                         |
| ----------------- | ------------------------------- |
| `pnpm dev`        | Run the API and web app         |
| `pnpm build`      | Build every package and app     |
| `pnpm lint`       | ESLint across the workspace     |
| `pnpm format`     | Prettier write                  |
| `pnpm typecheck`  | `tsc --noEmit` in every package |
| `pnpm test`       | Vitest in every package         |
| `pnpm db:migrate` | Create and apply a migration    |
| `pnpm db:seed`    | Reseed development data         |
| `pnpm db:reset`   | Drop, re-migrate and reseed     |
| `pnpm db:studio`  | Prisma Studio                   |

Target one package with `pnpm --filter @nestcord/api <script>`.

## Architecture

```text
React ── REST ──────► NestJS ──► Prisma ──► PostgreSQL
   └─── Socket.IO ──► NestJS
```

```text
apps/
  api/                 NestJS API
    src/config/        environment schema, validated at boot
    src/common/        cross-cutting concerns (Prisma service, guards)
    src/health/        health check
  web/                 React + Vite
    src/routes/        TanStack Router route tree (code-based)
    src/components/    shared UI
    src/features/      feature modules
    src/api/           fetch client and query keys
    src/stores/        Zustand UI state
packages/
  database/            Prisma schema, migrations, seed
  shared/              permission flags, socket events, shared types
```

State ownership on the web side: server data lives in TanStack Query, client-only UI state in
Zustand. Permission flags and socket event names are defined once in `@nestcord/shared` and used by
both the API and the web app.

## Testing

```bash
pnpm test
```

Tests cover the behavior that matters — permission resolution, environment validation, the health
check, and the message composer. Coverage targets are deliberately not enforced (PLAN.MD §27).

## Contributing

Work happens on branches and merges through pull requests; `main` is not committed to directly.
Conventions for commits, PRs, code style and security live in [CLAUDE.md](./CLAUDE.md) and
`.claude/rules/`.
