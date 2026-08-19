# Setting up NestCord on a new machine

A follow-along guide to get from a clean computer to a running app. Every command is copy-pasteable
and meant to be run in order, from the repository root.

For what the project _is_ and how it is organised, see [README.md](./README.md). For conventions while
working on it, see [CLAUDE.md](./CLAUDE.md).

---

## 1. Install the prerequisites

| Tool        | Version               | Check with         |
| ----------- | --------------------- | ------------------ |
| **Node.js** | 20.19+, 22.12+ or 24+ | `node --version`   |
| **pnpm**    | 11+                   | `pnpm --version`   |
| **Docker**  | any recent version    | `docker --version` |
| **Git**     | any recent version    | `git --version`    |

Node must be an **even-numbered** release — Prisma does not support 21, 23, and so on.

If pnpm is missing, the tidiest way to get it is through Node's built-in Corepack:

```bash
corepack enable
```

That picks up the exact version pinned in `package.json` (`pnpm@11.21.0`). Otherwise:
`npm install -g pnpm`.

**On Windows:** run everything inside WSL2, not PowerShell. Install Docker Desktop and turn on
_Settings → Resources → WSL integration_ for your distribution, or `docker` will not exist inside WSL.
Keep the repository on the Linux filesystem (`~/projects/...`), not under `/mnt/c/...` — file watching
and install speed are dramatically worse across the Windows mount.

---

## 2. Clone and install

```bash
git clone https://github.com/Elliot200504/NestCord.git
cd NestCord
pnpm install
```

This installs every workspace at once. Expect it to take a minute or two the first time.

---

## 3. Create your `.env`

There is **one** `.env` for the whole monorepo and it lives at the repository root. Both the API and
Prisma read that single file, so do not create one inside `packages/database` or `apps/api`.

```bash
cp .env.example .env
```

Now fill in the two blank secrets. Generate each one separately — do not reuse the same value twice:

```bash
echo "JWT_ACCESS_SECRET=$(openssl rand -base64 48)"
echo "JWT_REFRESH_SECRET=$(openssl rand -base64 48)"
```

Paste each line into `.env`, replacing the empty `JWT_ACCESS_SECRET=` and `JWT_REFRESH_SECRET=`.
They must be at least 32 characters; the API validates its environment at boot and **refuses to
start** if either is missing or too short.

Every other value in `.env.example` already works for local development — the database URL matches the
credentials in `docker-compose.yml`, and the ports match what the dev servers use. Leave them alone
unless something on your machine conflicts.

---

## 4. Start PostgreSQL

```bash
docker compose up -d
```

That is the only container this project needs — PostgreSQL 17 on `localhost:5432`. The API and the web
app run directly through pnpm, not in Docker.

Confirm it came up healthy before continuing:

```bash
docker compose ps
```

You want to see `nestcord-postgres` with status `Up` and `(healthy)`. The health check takes a few
seconds on first boot; if it still says `starting`, wait and re-run.

---

## 5. Create the schema and seed data

```bash
pnpm db:migrate    # applies migrations, generates the Prisma client
pnpm db:seed       # one development account to log in with
```

The seed prints the login when it finishes:

```text
test@nestcord.local  /  password123
```

That is all it creates. It does not delete anything, so re-running it after you have built
servers and channels is safe — an existing account is reported and left untouched. Create
your own servers, channels and extra users through the app.

---

## 6. Run it

```bash
pnpm dev
```

This builds the internal packages first, then starts the API and the web app together.

| What        | Where                          |
| ----------- | ------------------------------ |
| **Web app** | http://localhost:5173          |
| API         | http://localhost:3000/api      |
| Swagger     | http://localhost:3000/api/docs |

Open the web app. Requests to `/api` are proxied from Vite through to NestJS, so the browser only ever
talks to one origin and you will not hit CORS problems in development.

Stop both servers with `Ctrl+C`. PostgreSQL keeps running in the background — leave it, or stop it with
`docker compose stop`.

---

## 7. Confirm the setup is sound

```bash
pnpm typecheck && pnpm lint && pnpm test
```

All three should pass on a clean checkout. If they do, your environment is correct and anything failing
later is your own change.

---

## Everyday commands

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Run the API and web app              |
| `pnpm build`      | Build every package and app          |
| `pnpm typecheck`  | `tsc --noEmit` everywhere            |
| `pnpm lint`       | ESLint across the workspace          |
| `pnpm format`     | Prettier write                       |
| `pnpm test`       | Vitest everywhere                    |
| `pnpm db:migrate` | Create and apply a migration         |
| `pnpm db:seed`    | Reseed development data              |
| `pnpm db:reset`   | Drop, re-migrate and reseed          |
| `pnpm db:studio`  | Browse the database in Prisma Studio |

Target a single package with `pnpm --filter @nestcord/api <script>`.

---

## Troubleshooting

**`pnpm: command not found`**
Corepack was not enabled. Run `corepack enable`, then open a new terminal.

**`Environment variable not found: DATABASE_URL`**
Your `.env` is in the wrong place. It belongs at the **repository root**, beside `package.json` — not
in `packages/database`. Prisma is pointed at the root file explicitly by `prisma.config.ts`, so a
stray copy deeper in the tree is ignored.

**The API exits immediately on `pnpm dev`, complaining about configuration**
One of the JWT secrets is empty or shorter than 32 characters. Redo step 3. This is intentional — the
app fails loudly rather than booting with a weak signing key.

**`port is already allocated` / `address already in use` on 5432**
You already have PostgreSQL running on this machine. Either stop it
(`sudo systemctl stop postgresql`), or map the container to a different host port by changing
`docker-compose.yml` to `'5433:5432'` and updating the port in your `.env` `DATABASE_URL` to match.

**`Cannot connect to the Docker daemon`**
Docker is not running. On Windows, start Docker Desktop and check that WSL integration is enabled for
your distribution (see step 1).

**Vite starts but the page cannot reach the API**
Make sure both processes actually started — `pnpm dev` runs them in parallel and one can fail while the
other survives. Check the terminal output for a NestJS boot error, and confirm
http://localhost:3000/api responds.

**Changes to `packages/shared` are not picked up**
The internal packages are compiled, not read from source. `pnpm dev` builds them at startup, so
restart it — or rebuild in place with `pnpm packages:build`.

**Start completely over**

```bash
docker compose down -v    # deletes the database volume too
docker compose up -d
pnpm db:migrate
pnpm db:seed
```
