# Coding Style

## Simplicity first

This project is deliberately small. Before adding an abstraction, ask: does this solve a problem that
exists today? If not, do not add it. A junior/intermediate developer should be able to read any file
and understand it without tracing through five layers.

Delete-first mindset: prefer removing an indirection over adding one.

## Immutability

Create new objects, do not mutate existing ones.

```ts
// WRONG
user.verified = true;
list.push(item);

// RIGHT
const verified = { ...user, verified: true };
const next = [...list, item];
```

Rationale: predictable state, easier debugging, and it is what TanStack Query and React expect.

## File organization

Many small files beat few large ones.

- 200-400 lines typical, 800 hard maximum.
- Organize by feature/domain (`features/messages/`), not by type (`all-the-hooks/`).
- One exported concern per file where practical.

## Naming

- `camelCase` for variables and functions, `PascalCase` for classes, types and React components,
  `SCREAMING_SNAKE_CASE` for constants.
- Names say what a thing is, not how it is implemented: `sendMessage`, not `doMessageStuff`.
- Boolean names read as assertions: `isOwner`, `hasPermission`, `canManageChannel`.

## Error handling

- Handle errors explicitly; never swallow them silently.
- User-facing surfaces get a human-readable message; the server logs the detail.
- Never leak stack traces, SQL, or internal identifiers to the client.

## Input validation

Validate at every system boundary: HTTP request bodies, WebSocket payloads, query params, uploaded
file metadata, and anything read off disk. Fail fast with a clear message.

## Checklist before marking work complete

- [ ] Readable and well named
- [ ] Functions under ~50 lines, files under 800
- [ ] No nesting deeper than 4 levels (use early returns)
- [ ] Errors handled, no empty catches
- [ ] No magic numbers or hardcoded config
- [ ] No mutation
- [ ] No leftover `console.log` or commented-out code
