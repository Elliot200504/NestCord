---
name: realtime-events
description: How NestCord does Socket.IO — rooms, authorization, the event catalogue, presence, typing, and how events reach the TanStack Query cache. Use when adding or debugging realtime behavior.
---

# Realtime Events

Single NestJS process, single Socket.IO server, in-memory state. **No Redis adapter** (PLAN.MD ss.6).

## Connection

1. Client connects with the access token (auth handshake, not a query string in logs).
2. Gateway verifies the token; an invalid token disconnects immediately.
3. Server looks up the user's servers, channels, and DM conversations and joins the sockets to the
   rooms they are **authorized** to see.
4. Server records presence and broadcasts `presence:update`.

A user may have several sockets (multiple tabs). Track them as a set.

## Rooms

```text
server:{serverId}      member/role/channel changes
channel:{channelId}    messages, typing, reactions
dm:{conversationId}    DM messages
user:{userId}          notifications aimed at one person
```

Room membership _is_ the authorization boundary. Never emit to a room the user could not read, and
re-check permission when a user's roles change — remove them from channel rooms they lost access to.

## Event catalogue

Define these once in `packages/shared`:

```ts
export const SocketEvent = {
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  REACTION_ADD: 'reaction:add',
  REACTION_REMOVE: 'reaction:remove',
  PRESENCE_UPDATE: 'presence:update',
  MEMBER_JOIN: 'member:join',
  MEMBER_LEAVE: 'member:leave',
  NOTIFICATION_CREATE: 'notification:create',
} as const;
```

## Write first, broadcast second

```ts
async createMessage(channelId: string, userId: string, dto: CreateMessageDto) {
  const message = await this.messages.create(channelId, userId, dto); // persists
  this.server.to(`channel:${channelId}`).emit(SocketEvent.MESSAGE_CREATE, message);
  return message;
}
```

The broadcast payload is the same shape the REST endpoint returns, so the client can feed both into
the same cache entry.

## Incoming events are validated too

A socket payload is user input. Validate it with a DTO and authorize it with the same permission
resolution the HTTP guard uses. A `ValidationPipe` on the gateway handlers, not hand-rolled checks.

## Presence

```ts
type PresenceEntry = {
  status: 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';
  sockets: Set<string>;
};
```

In-memory `Map<userId, PresenceEntry>`. On disconnect remove the socket id; broadcast `OFFLINE` only
when the set becomes empty. Presence does not survive a restart, and that is by design — do not
persist it.

## Typing

Client emits `typing:start` throttled (e.g. at most once every few seconds while typing), server
relays it to the channel room. Never persisted. The receiving client expires the indicator locally
after a short timeout; do not rely on `typing:stop` arriving.

## Client side

Wire all listeners in `apps/web/src/websocket/`, once, at app level:

- high-frequency events (`message:*`, `reaction:*`, `typing:*`) -> `setQueryData` / local UI store
- structural events (`member:*`, role changes) -> `invalidateQueries`

Reconnect handling: on `connect` after a drop, invalidate the active channel's messages so any gap
during the disconnect is filled.

## Voice

Voice **state** only — who is connected to which voice channel, muted/deafened flags, broadcast to the
server room. No media transport, no SFU (PLAN.MD ss.17).

## Debugging checklist

- Event never arrives -> is the socket in that room? was it joined after an authorization check?
- Event arrives twice -> a listener registered per component instead of once at app level
- UI does not update -> the cache key used by the listener does not match the key the component reads
- Stale data after reconnect -> missing invalidation on `connect`
