---
paths:
  - "apps/web/**"
---

# Web Testing

Extends [common/testing.md](../common/testing.md).

## Tooling

Vitest + React Testing Library for components, Playwright for end-to-end journeys.

## What to cover

Component/unit:

- markdown rendering (bold, italic, strikethrough, inline code, code blocks, blockquotes, spoilers)
- mention parsing and rendering (`@username`, `@everyone`, `#channel`)
- message grouping (consecutive messages from the same author within the time window)
- message composer: submit, shift+enter newline, empty-input guard
- permission-driven UI (the delete action is absent without `MANAGE_MESSAGES`)

End-to-end (Playwright, keep it to a handful):

- log in, land in the app
- navigate server -> channel and see history
- send a message and see it appear
- open the friends page

## Style

- Query by role and accessible name, not by test id or class. If a query is hard to write, the markup
  is probably not accessible.
- Wrap components under test in a fresh `QueryClient` per test with retries disabled.
- Mock the network at the fetch/HTTP layer, not by stubbing hooks — the hook is part of what you are
  testing.
- Do not assert on implementation details (state variables, render counts). Assert on what the user
  sees.
