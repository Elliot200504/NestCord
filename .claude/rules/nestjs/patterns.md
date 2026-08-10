---
paths:
  - "apps/api/**"
---

# NestJS Patterns

## The layering rule

```text
Controller -> Service -> Prisma
```

Controllers handle transport: route, DTO validation, guards, status codes, serialization. Services hold
business logic and talk to Prisma directly. **Do not add repository, facade, factory, or provider layers.**
If a service grows past ~400 lines, split it by sub-feature, not by inventing a new layer.

## Module layout

One module per domain concept, matching PLAN.MD ss.2:

```text
apps/api/src/
  auth/ users/ servers/ channels/ messages/ roles/
  friends/ dms/ attachments/ notifications/ gateway/ common/
```

Inside a module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, and tests next to the code.

Cross-module needs go through the other module's exported service, never by reaching into its
internals or duplicating its queries.

## DTOs and validation

- Every request body and query param has a DTO with `class-validator` decorators.
- `ValidationPipe` runs globally with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`
  so unknown fields are rejected rather than silently ignored.
- DTOs are the API contract — annotate them for Swagger so the generated docs stay honest.

## Responses

- Never return a Prisma `User` directly: it contains `passwordHash`. Map to an explicit response
  shape (or use a serializer with `@Exclude`).
- Sessions, refresh token hashes, and other users' emails never leave the server.
- Use Nest's built-in HTTP exceptions (`NotFoundException`, `ForbiddenException`, ...) so status codes
  and error shapes stay consistent.

## Configuration

- `@nestjs/config` with a validated schema; the app refuses to boot if a required variable is missing.
- No `process.env` reads scattered through services — inject `ConfigService`.

## Rate limiting

`@nestjs/throttler` with in-memory storage. Apply tighter limits to login, registration, message
creation, friend requests, and uploads. No Redis (PLAN.MD ss.23).

## Attachments

Local filesystem under `apps/api/uploads/`. Validate MIME type and size, generate a safe random
filename, store the metadata row in PostgreSQL. Do not build a storage abstraction for one backend.
