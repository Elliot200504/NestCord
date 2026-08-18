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

Peer-to-peer **mesh**, capped at `MAX_VOICE_PARTICIPANTS` (8). No SFU and no media server (PLAN.MD
ss.17) — the API only ever relays signalling and tracks who is in which call.

- **State is in memory**, in `VoiceStateService`, exactly like presence. Being in a call is a fact
  about a live socket, so a table would survive a restart and leave ghosts sitting in an empty
  channel. A restart clears every call by construction. There is no migration for voice.
- **State broadcasts go to `rooms.channel()`**, which is already the "who may see this channel"
  boundary — so people who are not in a call still see who is.
- **Signalling goes to a single socket id** via `relayToSocket`, not to a room or a user room: the
  call lives in one tab, and a copy to that person's other tabs would have each of them answer the
  same offer.
- **`voice:join` is answered by an ack**, the only handler in the gateway that replies to its sender.
  A client must not open a microphone hopefully and learn afterwards it was refused, and "the channel
  is full" has to arrive as the answer to that request.
- **Never trust the claimed channel.** Every signalling relay uses the channel the server recorded
  for that socket and verifies the target is in the same call. Taking `channelId` from the payload
  would let a client push SDP into a channel it cannot even see.
- **Established connections outlive a permission change.** Once ICE completes the media never touches
  the server, so anything that removes the right to be in a call has to evict explicitly — a kick or
  ban (`evictFromServer`), an override that takes `CONNECT` away, or deleting the channel.

### `SPEAK` is not enforceable in a mesh

`canSpeak` is resolved on the server and travels on the voice state, and the client publishes no audio
track without it — but the server never sees the media, so a patched client could publish anyway. This
is a recorded trade-off, not an oversight: real enforcement needs the SFU ss.17 rules out. Do not
describe `SPEAK` as a security boundary.
