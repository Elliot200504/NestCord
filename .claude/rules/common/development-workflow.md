# Development Workflow

Extends [git-workflow.md](./git-workflow.md) with everything that happens before the commit.

## Build order

Follow the phases in PLAN.MD ss.34. The foundation (workspace, NestJS, Vite, Prisma, Docker Compose,
ESLint/Prettier, initial schema, base layout) must run end to end before feature work starts.

Do not jump ahead: authentication depends on the schema, servers depend on auth, channels depend on
servers, messaging depends on channels, realtime depends on messaging.

## Per-feature loop

1. **Look before building** — read the existing modules and shared types. Reuse the message system for
   DMs, reuse the permission guard for new routes. Duplicate systems are the main risk in this repo.
2. **Check the docs** — for Prisma, NestJS, TanStack, Socket.IO API details, use the
   `documentation-lookup` skill (Context7) rather than recalling from memory. Version details matter.
3. **Plan when it is non-trivial** — anything touching 3+ files or the schema gets a short plan first
   (`planner` agent). Skip the ceremony for small fixes.
4. **Schema first** — change `packages/database/prisma/schema.prisma`, create the migration, update the
   seed if the shape changed.
5. **API next** — DTO, service, controller, guard, then the gateway event if the feature is realtime.
6. **Web last** — query/mutation hook, then components, then wire the socket event to query
   invalidation.
7. **Test the important parts** — auth, permissions, message CRUD, membership, friend requests. Not
   everything (PLAN.MD ss.27).
8. **Verify** — run the `/verify` command or the `verification-loop` skill before declaring done.
9. **Review** — `code-reviewer` agent; `security-reviewer` too when auth, input handling, uploads, or
   permissions changed.

## When something is ambiguous

Prefer the simplest reading that satisfies PLAN.MD. If two readings mean materially different work,
ask. Do not silently expand scope into "while I was in there" refactors.
