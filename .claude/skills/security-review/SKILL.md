---
name: security-review
description: Security checklist and patterns for NestCord — auth, sessions, authorization, uploads, secrets, rate limiting. Use when adding authentication, handling user input, creating endpoints, or touching permissions.
---

# Security Review (NestCord)

Scope: a small chat app. The realistic threats are a logged-in user reaching data they should not, and
secrets landing in git. Everything below targets those.

## 1. Secrets

```ts
// NEVER
const secret = 'super-secret-jwt-key';

// ALWAYS — validated at boot, app refuses to start without it
const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  WEB_URL: z.string().url(),
  UPLOAD_DIR: z.string(),
});
```

New variable -> add to `.env.example` with a placeholder. `.env` is never committed. If a secret
leaks, rotate it before anything else.

## 2. Passwords and tokens

```ts
import * as argon2 from 'argon2';

const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
const ok = await argon2.verify(user.passwordHash, password);
```

- Access token: short-lived JWT, minimal claims.
- Refresh token: random, long-lived, stored **hashed** in `Session`, rotated on every use.
- Reuse of an already-rotated refresh token means theft — revoke the whole session.
- Logout deletes the session row.
- Login must not reveal whether the email exists ("Invalid email or password" for both cases).

## 3. Authorization

The number-one place a real bug will appear. See the `permissions-model` skill for the algorithm.

- Guard globally, opt out with `@Public()` — forgetting a decorator then fails closed.
- Every server/channel route checks membership **and** the specific permission.
- Gateway events get the same treatment as HTTP routes.
- Ownership: only the author edits their own message; `MANAGE_MESSAGES` deletes others'.
- Return 404 rather than 403 for resources the user should not even know exist.

## 4. Never leak

```ts
// BAD — passwordHash goes straight to the client
return this.prisma.user.findUnique({ where: { id } });

// GOOD — explicit select
return this.prisma.user.findUnique({
  where: { id },
  select: { id: true, username: true, avatarUrl: true, status: true },
});
```

Also never return: refresh token hashes, session rows, other users' emails, Prisma error text, or
stack traces.

## 5. Input

- Every body, query, param, and socket payload has a DTO; `whitelist: true` and
  `forbidNonWhitelisted: true` so unexpected fields are rejected.
- Prisma's query API parameterizes for you. If `$queryRaw` is ever unavoidable, use tagged-template
  parameters, never string concatenation.
- Message content is stored raw and escaped at render time. On the web side, `dangerouslySetInnerHTML`
  requires sanitized input and a stated reason.

## 6. Uploads

```ts
const ALLOWED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;
```

- Validate MIME type and size server-side (the client's `Content-Type` is a hint, not proof).
- Generate the stored filename (`randomUUID() + safeExtension`) — never use the uploaded name as a
  path.
- Reject path separators and `..` outright.
- Serve uploads from a fixed directory; never join user input into the path.
- Store `filename`, `mimeType`, `size`, `url` in PostgreSQL.

## 7. Rate limiting

`@nestjs/throttler`, in-memory. Tight limits on login, registration, message creation, friend
requests, and uploads. No Redis for this.

## 8. Transport

- CORS restricted to `WEB_URL`; no wildcard with credentials.
- Cookies: `httpOnly`, `secure` in production, `sameSite=lax`.
- Helmet for baseline headers.

## Pre-commit checklist

- [ ] No hardcoded secrets; `.env.example` updated
- [ ] Every new route and gateway event is authorized server-side
- [ ] No `passwordHash` / token / other-user email in any response shape
- [ ] All inputs validated by DTOs
- [ ] Uploads validated and renamed
- [ ] Rate limits on the sensitive endpoints
- [ ] Errors return safe messages, details only in server logs

## Known false positives

Placeholders in `.env.example`, clearly-labelled test credentials in test files, hashes used for
checksums rather than passwords.
