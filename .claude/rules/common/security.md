# Security Guidelines

Reasonable security for a small app — not a compliance program. But the items below are non-negotiable
because they protect real user accounts.

## Before any commit

- [ ] No hardcoded secrets (JWT secrets, database URLs, tokens)
- [ ] All user input validated by a DTO or schema
- [ ] Authorization checked server-side on every state-changing route and gateway event
- [ ] No password hashes, refresh tokens, emails of other users, or stack traces in any response
- [ ] Rate limiting present on auth, message creation, friend requests, and uploads
- [ ] Uploaded files validated (MIME type, size, generated safe filename)

## Never trust the client

The frontend computes permissions only to decide what to _render_. Every permission decision that
matters is re-computed on the server from the database. A user editing their own JS must not be able
to send a message to a channel they cannot view.

## Secrets

- Load from environment variables only. Validate they exist at startup and fail loudly if missing.
- New variables go into `.env.example` with an empty or placeholder value.
- A real `.env` is never committed. If one leaks, rotate the secret before anything else.

## Auth specifics

- Passwords hashed with **Argon2**. Never store or log plaintext.
- Short-lived access token + long-lived refresh token. Refresh tokens are stored **hashed** in the
  `Session` table and rotated on use.
- Logout invalidates the session row, not just the client-side token.

## If a security issue is found

1. Stop the current work.
2. Invoke the `security-reviewer` agent or the `security-review` skill.
3. Fix CRITICAL issues before continuing anything else.
4. Rotate any exposed secret.
5. Grep for the same mistake elsewhere in the codebase.
