---
paths:
  - 'apps/web/**'
---

# State Management

One rule decides where state goes:

**Server data -> TanStack Query. Client-only UI state -> Zustand. Never the reverse.**

## TanStack Query

Owns everything the API knows about: current user, servers, channels, messages, members, friends,
conversations, notifications.

- Query keys are structured and consistent: `['messages', channelId]`, `['server', serverId, 'members']`.
  Define key factories in `api/` so they cannot drift.
- Message history uses `useInfiniteQuery` with the API's cursor.
- Mutations: create server, create channel, send/edit/delete message, reactions, friend requests.
- Optimistic updates for the interactions that must feel instant (sending a message, toggling a
  reaction), with rollback in `onError`.
- Do not copy query data into `useState` or a store. Read it from the cache where it is needed.

## Socket events and the cache

Realtime events update the cache; they do not maintain a parallel copy of the data.

- `message:create` -> `setQueryData` to append to that channel's page (cheap, avoids a refetch).
- `message:update` / `message:delete` -> patch or remove that message in place.
- `member:join` / `member:leave` / role changes -> invalidate the member list.
- `presence:update` -> patch the presence entry.

Wire this in one place (`websocket/`), not per component.

## Zustand

Only ephemeral UI state, for example:

```text
selectedServerId  selectedChannelId  sidebarOpen
memberListOpen    activeModal        theme
composerDrafts    typingUsers
```

Keep stores small and sliced by concern. No async fetching inside a store. If a value can be derived
from the route or from query data, derive it instead of storing it.
