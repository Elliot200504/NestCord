# NestCord

A Discord clone, and a deliberate exercise in directing AI coding tools across a real codebase.

Scope is fixed and small: one API process, one PostgreSQL database, local file storage, a few hundred
users.

Those constraints are committed alongside the code: [PLAN.MD](./PLAN.MD) for what gets built and what
deliberately does not, [CLAUDE.md](./CLAUDE.md) and `.claude/rules/` for the standards every change
is reviewed against.

> **Read before running this anywhere real.** Most of the code here was written by AI tools under my
> direction and review. It is a learning project: nothing in it has been audited or
> penetration-tested, and the security-sensitive parts — authentication, authorization, file uploads
> — are written to be sensible, not proven. Take it apart, learn from it, borrow from it. Do not put
> it in front of real users and expect it to hold.

## Dependencies

You need:

- Node.js 20.19+, 22.12+ or 24+ (even-numbered releases only — Prisma)
- pnpm 11+ (`npm install -g pnpm`)
- Docker (runs PostgreSQL)

Built with:

- **Backend** — NestJS, Prisma, PostgreSQL, Socket.IO, JWT, Argon2
- **Frontend** — React, Vite, TanStack Router + Query, Zustand, Tailwind, Radix
- **Tooling** — pnpm workspaces, TypeScript, ESLint, Prettier, Vitest, Playwright

## Setup

```bash
git clone https://github.com/Elliot200504/NestCord.git
cd NestCord
pnpm install

cp .env.example .env
openssl rand -base64 48    # run twice, paste into JWT_ACCESS_SECRET and JWT_REFRESH_SECRET

docker compose up -d       # PostgreSQL on localhost:5432
pnpm db:migrate
pnpm db:seed               # sample users, servers, channels, messages

pnpm dev
```

- Web — http://localhost:5173
- API — http://localhost:3000/api
- Swagger — http://localhost:3000/api/docs

Seeded login: `test@nestcord.local` / `password123`

## Authentication

Register at http://localhost:5173/register, or log in with the seeded account above.

- Passwords are hashed with Argon2id. `POST /api/auth/register|login|refresh|logout` and
  `GET /api/auth/me` are the whole surface.
- A short-lived access token comes back in the response body and is kept in memory by the web app —
  never in `localStorage`.
- The long-lived refresh token is an httpOnly cookie scoped to `/api/auth`, stored hashed in the
  `Session` table and rotated on every refresh. Logging out deletes the session row, so the access
  token stops working immediately.
- Every API route requires a valid token unless it is explicitly marked `@Public()`.

All environment variables live in one `.env` at the repo root; `.env.example` lists them all. The API
validates them at boot and refuses to start if any are missing.

## Errors

Users are never shown a technical error. A global exception filter turns everything a route throws
into one shape: a 4xx keeps the sentence the route wrote for the user, and anything unexpected — a
crash, an unhandled Prisma error — becomes a generic apology plus a short reference code such as
`ERR-9F3A2C`. The real message and stack go to the `ErrorLog` table and the server log, never to the
client.

Admins read those at **Settings → Error log**, newest first, and can look one up by the reference a
user quoted. Who counts as an admin is `ADMIN_EMAILS` in `.env`, a comma-separated list of email
addresses — empty means nobody, so the route is closed until it is configured:

```bash
ADMIN_EMAILS="test@nestcord.local"    # the seeded account, to see the page in development
```

The check runs on the server against the database on every request, so the frontend flag only decides
whether the link is listed.

## Commands

| Command           | Purpose                      |
| ----------------- | ---------------------------- |
| `pnpm dev`        | Run the API and web app      |
| `pnpm build`      | Build everything             |
| `pnpm lint`       | ESLint                       |
| `pnpm typecheck`  | `tsc --noEmit` everywhere    |
| `pnpm test`       | Vitest                       |
| `pnpm db:migrate` | Create and apply a migration |
| `pnpm db:seed`    | Reseed development data      |
| `pnpm db:reset`   | Drop, re-migrate and reseed  |
| `pnpm db:studio`  | Prisma Studio                |

Target one package: `pnpm --filter @nestcord/api <script>`.

### End-to-end tests

`pnpm test` is Vitest only. The Playwright journeys drive the real stack, so they run
separately and need PostgreSQL up and the database seeded:

```bash
pnpm --filter @nestcord/web exec playwright install --with-deps chromium   # once
pnpm db:seed
pnpm --filter @nestcord/web test:e2e        # add :ui for the Playwright inspector
```

They start `pnpm dev` themselves, or reuse it if it is already running. Note that they
sign in as the seeded account and leave their messages behind in `#general`.

## Layout

```text
apps/api/          NestJS API
apps/web/          React + Vite
packages/database/ Prisma schema, migrations, seed
packages/shared/   types, constants, permission flags
```

## License

[MIT](./LICENSE)
