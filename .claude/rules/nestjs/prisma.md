---
paths:
  - "packages/database/**"
  - "**/*.prisma"
---

# Prisma and PostgreSQL

## Migrations

- Every schema change ships with a migration: `pnpm db:migrate` (`prisma migrate dev`).
- Never `prisma db push` on a schema that has migrations — it desynchronizes the migration history.
- Migrations are committed. Never edit an applied migration; add a new one.
- After a schema change: regenerate the client (`pnpm db:generate`) and update the seed if the shape
  changed.

## Schema style

- Keep it readable. Explicit relation names, sensible `onDelete` behavior (deleting a channel deletes
  its messages; deleting a user does not silently erase a server).
- Timestamps: `createdAt @default(now())`, `updatedAt @updatedAt`.
- Use enums for `ChannelType`, `MemberStatus`, `FriendshipStatus`, `PresenceStatus`.
- Permissions stored as a bitfield integer on `Role`, with the flag names defined once in
  `packages/shared`.

## Indexes

Create these (PLAN.MD ss.25), and no more until a query is actually slow:

```text
User.username, User.email                (unique)
ServerMember.serverId, ServerMember.userId, @@unique([serverId, userId])
Message.channelId, Message.createdAt, Message.authorId
Reaction.messageId, @@unique([messageId, userId, emoji])
Friendship.userId, Friendship.friendId
```

## Queries

- **No N+1.** Fetch relations with `include`/`select` in one query, not in a loop.
- `select` only the fields needed — never let `passwordHash` reach a response by accident.
- Message history is always paginated (cursor on `id`/`createdAt`, newest first, sane page size).
  Never load a whole channel.
- Multi-row writes that must succeed together go in `prisma.$transaction`.
- Message search uses PostgreSQL full-text search. No Elasticsearch (PLAN.MD ss.22).

## Seed

`pnpm db:seed` produces a usable dev world: 10 users, 2-3 servers with channels and roles, sample
messages and reactions, friendships, DM conversations, and a known test account with a documented
password. Keep it idempotent enough to run after `db:reset`.
