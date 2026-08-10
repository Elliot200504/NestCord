---
paths:
  - 'apps/web/**'
---

# React Patterns

## Structure

```text
apps/web/src/
  routes/       TanStack Router route definitions
  components/   shared, presentational, feature-agnostic
  features/     auth, servers, channels, messages, friends, dms, settings
  api/          fetch client + typed endpoint functions
  hooks/        cross-feature hooks
  stores/       Zustand UI state
  websocket/    socket client, event -> query-cache wiring
  lib/          pure helpers (markdown, mentions, formatting)
```

A feature owns its components, hooks, and types. Something used by two features moves to
`components/` or `hooks/`; it does not get imported across feature folders.

## Components

- Presentational by default. Data fetching lives in hooks, not inside deeply nested components.
- Small and composable: the message list is `MessageList > MessageGroup > Message > MessageContent`,
  each doing one thing (PLAN.MD ss.15).
- Every list key is a stable id, never the array index — messages reorder and get deleted.
- Props over context; reach for context only when prop drilling passes 3+ levels.

## Hooks

- `useEffect` is for synchronizing with something outside React (socket subscriptions, focus, title).
  It is not for deriving state — compute during render instead.
- Complete dependency arrays. If a lint rule complains, the fix is the code, not the disable comment.
- Every effect that subscribes returns a cleanup that unsubscribes.

## Routing (TanStack Router)

Routes per PLAN.MD ss.11. Authenticated routes are protected in the route tree via a `beforeLoad`
check, so an unauthenticated user is redirected before any component renders. Do not scatter auth
checks inside components.

## UI

- Tailwind for styling, Radix primitives for dialogs/menus/popovers, Lucide for icons.
- Radix gives you accessible focus management and keyboard behavior — use it rather than
  hand-rolling context menus and modals.
- The layout is the Discord four-column shell (servers, channels, messages, members) and must stay
  responsive; collapse the side panels on narrow viewports.
- Every async surface has a loading state and an error state. A blank screen while loading is a bug.

## Performance

Do not memoize by default. Reach for `memo`/`useMemo`/`useCallback` when a list is long or a render is
measurably expensive — message list virtualization is the one place it will genuinely matter.
