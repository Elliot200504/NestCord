# NestCord

A Discord clone I built as a personal learning project. Not a product — one API process, one
PostgreSQL database, local file storage, scoped for a few hundred users at most.

Full spec: [PLAN.MD](./PLAN.MD).

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

All environment variables live in one `.env` at the repo root; `.env.example` lists them all. The API
validates them at boot and refuses to start if any are missing.

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

## Layout

```text
apps/api/          NestJS API
apps/web/          React + Vite
packages/database/ Prisma schema, migrations, seed
packages/shared/   types, constants, permission flags
```

## License

[MIT](./LICENSE)
