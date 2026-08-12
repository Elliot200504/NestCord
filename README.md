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

## Profiles and settings

Settings live at http://localhost:5173/settings — account, profile and appearance.

- **Profile** — display name, bio and an accent colour, with a live preview of the card everyone else
  sees. `PATCH /api/users/me`; sending `null` clears a field.
- **Avatars** — uploaded to `apps/api/uploads/avatars` (gitignored) and served from `/uploads`. The
  file type is decided by the image's own leading bytes, not by its name or declared MIME type, and
  the stored filename is generated. Replacing or removing an avatar deletes the old file.
- **Presence** — pick Online, Idle, Do not disturb or Invisible from the user panel. It is stored on
  the user; connection-driven presence arrives with the gateway in a later phase.
- **Devices** — every signed-in session is listed with an option to sign one or all others out.
  Changing your password ends every other session automatically.
- **Appearance** — theme and message density, kept in this browser rather than on the account.

## Channels

Each server's sidebar is real data: `GET /api/servers/:serverId/channels` returns the channels and
categories **you** can see, with your own resolved permissions for each one.

- **Categories** are channels of type `CATEGORY`; the channels inside one point at it with `parentId`.
  Deleting a category leaves its channels at the top level rather than deleting them.
- **Text and voice channels** carry a name, topic, position and category. Names are stored as
  `#like-this` — what you type is slugified, and the dialog shows the name it will be saved under.
  Voice channels can be created and arranged; talking in one arrives with the gateway.
- **Channel permissions** are per-role overrides of the server-wide flags: allow, inherit or deny.
  They are stored as two bitfields and resolved server-side on every request, in the order owner →
  roles → `ADMINISTRATOR` → `@everyone` override → role overrides → member override. Losing
  `VIEW_CHANNEL` clears everything else, which is what hides a channel from the sidebar.
- Creating or editing a channel needs `MANAGE_CHANNELS`, and editing its overrides needs
  `MANAGE_ROLES` — both checked _in that channel_, so an override that takes the permission away is
  respected. Nobody can grant a permission they do not hold themselves, or touch a role at or above
  their own.

`/app/:serverId` with no channel redirects to the first text channel you can see.

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
