---
name: documentation-lookup
description: Fetch current library documentation (Context7 MCP or official docs) instead of relying on training data. Use when working with NestJS, Prisma, TanStack Router/Query, Socket.IO, Zustand, Radix, Tailwind, or Vite APIs.
---

# Documentation Lookup

This project pins "the newest stable versions available when starting the project" (PLAN.MD ss.10).
Recalled API shapes go stale, and the fast-moving libraries here have all had breaking changes.

## When to look it up

- Configuration questions (Vite config, Nest module options, Prisma datasource setup)
- Any TanStack Router or Query API — v1 changed `initialPageParam`, `getNextPageParam`, and the object
  signature for `useQuery`/`useMutation`
- Prisma client API details, migration flags, `$transaction` behavior
- NestJS decorators, guards, pipes, gateway lifecycle hooks
- Socket.IO server/client options and auth handshake
- Radix primitive props and composition
- Anything where you would otherwise write "I think the option is called…"

## How

1. **Check the installed version first** — `package.json` and the lockfile. Documentation for the wrong
   major version is worse than none.
2. **Context7 MCP** when available: `resolve-library-id` with the library name and the full question,
   then `query-docs` with the returned id. Never call `query-docs` without a resolved id.
3. **Official docs** otherwise: nestjs.com, prisma.io/docs, tanstack.com, socket.io/docs,
   radix-ui.com, tailwindcss.com, vite.dev.
4. **Node modules as ground truth** — for a small API question, the installed `.d.ts` in
   `node_modules/<pkg>` is faster and cannot be out of date.

## Useful library ids

```text
/nestjs/nest
/prisma/prisma
/tanstack/router
/tanstack/query
/socketio/socket.io
/pmndrs/zustand
/radix-ui/primitives
/tailwindlabs/tailwindcss
/vitejs/vite
```

## Applying what you find

Match the installed version, adapt the example to this project's conventions (see
`.claude/rules/`), and do not copy an example's architecture wholesale — vendor docs routinely
demonstrate patterns heavier than this project wants.
