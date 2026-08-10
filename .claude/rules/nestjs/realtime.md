---
paths:
  - 'apps/api/src/gateway/**'
  - 'apps/web/src/websocket/**'
---

# Realtime (Socket.IO)

Single NestJS instance, single Socket.IO server, **no Redis adapter** (PLAN.MD ss.6).

## Rooms

```text
server:{serverId}       server-wide events (member join/leave, role changes)
channel:{channelId}     message and typing events
dm:{conversationId}     direct and group DM events
user:{userId}           notifications targeted at one user
```

A socket joins a room only after the server has verified the user may see it. Room membership is the
authorization boundary — never broadcast to a room the user could not read.

## Event names

```text
message:create   message:update   message:delete
typing:start     typing:stop
reaction:add     reaction:remove
presence:update
member:join      member:leave
notification:create
```

Keep this list as a shared constant in `packages/shared` so the web client cannot typo an event name.

## Payloads

Emit the same shape the REST API returns for that resource, so the web client can feed both into the
same TanStack Query cache without a translation layer.

## Ordering: write first, broadcast second

Persist through the service, then emit. Never emit an optimistic event the database has not accepted.
The HTTP response and the broadcast come from the same service call.

## Presence

In-memory map of `userId -> { status, socketIds }`. States: `ONLINE`, `IDLE`, `DO_NOT_DISTURB`,
`OFFLINE`. Presence resets on restart, and that is fine — do not persist it or add a store for it.

Clean up on `disconnect`: remove the socket id, and only broadcast `OFFLINE` when the user has no
remaining sockets.

## Typing indicators

Ephemeral, never persisted, expire client-side after a few seconds. Throttle `typing:start` so a fast
typist does not emit per keystroke.

## Voice

Implement voice **state** and UI only (who is connected to which voice channel). No SFU, no media
transport (PLAN.MD ss.17).
