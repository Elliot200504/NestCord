---
paths:
  - 'apps/api/**'
---

# API Security and Authorization

Extends [common/security.md](../common/security.md).

## Authentication

- Passwords: **Argon2id**. Never plaintext, never a fast hash.
- Access token: short-lived JWT (minutes), carries `userId` and nothing sensitive.
- Refresh token: long-lived, random, stored **hashed** in `Session`, rotated on every refresh. A reused
  old refresh token means the session is compromised — revoke it.
- Logout deletes the session row. Expired sessions are cleaned up.
- Guards are global by default; public routes opt out with an explicit `@Public()` decorator, so
  forgetting a guard fails closed.

## The permission model

Flags (PLAN.MD ss.5): `VIEW_CHANNEL`, `SEND_MESSAGES`, `MANAGE_MESSAGES`, `ATTACH_FILES`,
`ADD_REACTIONS`, `CONNECT`, `SPEAK`, `MANAGE_CHANNELS`, `MANAGE_SERVER`, `MANAGE_ROLES`,
`KICK_MEMBERS`, `BAN_MEMBERS`, `ADMINISTRATOR`.

Resolution order for a member in a channel:

1. Server owner -> all permissions.
2. Union of the member's role permissions, including `@everyone`.
3. `ADMINISTRATOR` -> all permissions, short-circuit.
4. Apply channel overrides: role denies, then role allows, then member deny, then member allow.

Keep this in **one** function in `common/` (or `packages/shared` for the flag definitions), used by
both the guard and the gateway. Two copies will drift, and the drift is a security hole.

Role hierarchy: a member may only manage roles below their own highest role position, and may not
kick or ban someone with an equal or higher position.

## Authorization checks

- Every controller route that touches a server resource verifies membership _and_ the specific
  permission — membership alone is not authorization.
- Gateway events are authorized the same way as HTTP routes. A socket connection is not a bypass.
- Ownership checks for edit/delete: author may edit their own message; `MANAGE_MESSAGES` may delete
  others'. Nobody may edit someone else's message content.
- Frontend permission checks are cosmetic only.

## Input and transport

- CORS restricted to `WEB_URL`; no wildcard origin with credentials.
- Cookies (if used for refresh tokens): `httpOnly`, `secure` in production, `sameSite=lax`.
- Uploads: extension/MIME allowlist, hard size cap, generated filename, never serve from a
  user-controlled path.
- Message content: store raw, escape/sanitize at render time. Never build SQL by string concatenation —
  use Prisma's query API, and parameterize `$queryRaw` if it is ever unavoidable.
