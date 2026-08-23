import { describe, expect, it } from 'vitest';
import type { Server } from 'socket.io';

import { SocketEvent, type Message, type ServerMember } from '@nestcord/shared';

import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import type { SocketRooms } from './socket-rooms';
import { VoiceStateService } from './voice-state.service';

const CHANNEL = 'channel-1';

interface Sent {
  room: string;
  event: string;
  payload: unknown;
}

function message(): Message {
  return {
    id: 'message-1',
    channelId: CHANNEL,
    conversationId: null,
    author: {
      id: 'user-ada',
      username: 'ada',
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE',
    },
    content: 'hello',
    createdAt: '2026-08-12T09:00:00.000Z',
    editedAt: null,
    replyTo: null,
    attachments: [],
    reactions: [],
  };
}

function joiner(): ServerMember {
  return {
    user: {
      id: 'user-grace',
      username: 'grace',
      displayName: null,
      avatarUrl: null,
      accentColor: null,
      status: 'ONLINE',
    },
    nickname: null,
    joinedAt: '2026-08-12T09:00:00.000Z',
    roleIds: ['role-everyone'],
  };
}

function buildHarness(
  options: { attach?: boolean; serverIds?: string[]; channelIds?: string[] } = {},
) {
  const { attach = true, serverIds = ['server-1', 'server-2'], channelIds = [CHANNEL] } = options;
  const sent: Sent[] = [];
  const evictions: Array<{ from: string; rooms: string[] }> = [];
  const admissions: Array<{ from: string; rooms: string[] }> = [];

  const server = {
    to: (room: string) => ({
      emit: (event: string, payload: unknown) => sent.push({ room, event, payload }),
    }),
    in: (from: string) => ({
      socketsLeave: (left: string | string[]) =>
        evictions.push({ from, rooms: Array.isArray(left) ? left : [left] }),
      socketsJoin: (joined: string | string[]) =>
        admissions.push({ from, rooms: Array.isArray(joined) ? joined : [joined] }),
    }),
  } as unknown as Server;

  const presence = new PresenceService();
  const rooms = {
    serverIdsOf: async () => serverIds,
    channelIdsIn: async () => channelIds,
    visibleChannelIds: async () => channelIds,
  } as unknown as SocketRooms;
  const voice = new VoiceStateService();
  const realtime = new RealtimeService(presence, rooms, voice);

  if (attach) realtime.attach(server);

  return { realtime, presence, voice, sent, admissions, evictions };
}

describe('RealtimeService', () => {
  it('sends a new message to its channel room and nowhere else', () => {
    const { realtime, sent } = buildHarness();

    realtime.messageCreated(message());

    expect(sent).toEqual([
      { room: `channel:${CHANNEL}`, event: SocketEvent.MESSAGE_CREATE, payload: message() },
    ]);
  });

  it('sends a deletion with only the ids needed to patch a cache', () => {
    const { realtime, sent } = buildHarness();

    realtime.messageDeleted({ channelId: CHANNEL, conversationId: null, messageId: 'message-1' });

    expect(sent[0]).toEqual({
      room: `channel:${CHANNEL}`,
      event: SocketEvent.MESSAGE_DELETE,
      payload: { channelId: CHANNEL, conversationId: null, messageId: 'message-1' },
    });
  });

  it('sends who reacted rather than the grouped list', () => {
    // The grouped list carries a `me` flag that is only true for one viewer, so
    // broadcasting it would tell everyone they had reacted themselves.
    const { realtime, sent } = buildHarness();

    realtime.reactionAdded({
      channelId: CHANNEL,
      conversationId: null,
      messageId: 'message-1',
      emoji: '👍',
      userId: 'user-ada',
    });

    expect(sent[0]?.payload).toEqual({
      channelId: CHANNEL,
      conversationId: null,
      messageId: 'message-1',
      emoji: '👍',
      userId: 'user-ada',
    });
  });

  it('aims a notification at one person’s own room', () => {
    const { realtime, sent } = buildHarness();

    realtime.notify('user-grace', {
      id: 'notification-1',
      type: 'MENTION',
      sourceId: 'message-1',
      createdAt: '2026-08-12T09:00:00.000Z',
      actor: null,
      serverId: 'server-1',
      channelId: CHANNEL,
      conversationId: null,
      preview: 'hey',
    });

    expect(sent[0]?.room).toBe('user:user-grace');
    expect(sent[0]?.event).toBe(SocketEvent.NOTIFICATION_CREATE);
  });

  it('announces presence to every server the user shares, and no further', async () => {
    const { realtime, presence, sent } = buildHarness();
    presence.connect('user-ada', 'socket-1', 'IDLE');

    await realtime.announcePresence('user-ada');

    expect(sent.map((entry) => entry.room)).toEqual(['server:server-1', 'server:server-2']);
    expect(sent[0]?.payload).toEqual({ userId: 'user-ada', status: 'IDLE' });
  });

  it('announces OFFLINE for a user with no live socket', async () => {
    const { realtime, sent } = buildHarness();

    await realtime.announcePresence('user-ada');

    expect(sent[0]?.payload).toEqual({ userId: 'user-ada', status: 'OFFLINE' });
  });

  it('says nothing when the user shares no server with anyone', async () => {
    const { realtime, sent } = buildHarness({ serverIds: [] });

    await realtime.announcePresence('user-ada');

    expect(sent).toEqual([]);
  });

  it('puts a departing member out of the server and channel rooms', async () => {
    const { realtime, sent, evictions } = buildHarness();

    realtime.memberLeft({ serverId: 'server-1', userId: 'user-ada' });

    // The eviction is fire-and-forget, so it lands a tick after the broadcast.
    await Promise.resolve();
    await Promise.resolve();

    expect(sent[0]).toMatchObject({ room: 'server:server-1', event: SocketEvent.MEMBER_LEAVE });
    expect(evictions).toEqual([
      { from: 'user:user-ada', rooms: ['server:server-1', `channel:${CHANNEL}`] },
    ]);
  });

  it('puts a new member into the server and channel rooms', async () => {
    const { realtime, sent, admissions } = buildHarness();

    realtime.memberJoined({ serverId: 'server-1', member: joiner() });

    // The admission is fire-and-forget, so it lands a tick after the broadcast.
    await Promise.resolve();
    await Promise.resolve();

    expect(sent[0]).toMatchObject({ room: 'server:server-1', event: SocketEvent.MEMBER_JOIN });
    expect(admissions).toEqual([
      { from: 'user:user-grace', rooms: ['server:server-1', `channel:${CHANNEL}`] },
    ]);
  });

  it('only admits a new member to the channels they can see', async () => {
    const { realtime, admissions } = buildHarness({ channelIds: [] });

    realtime.memberJoined({ serverId: 'server-1', member: joiner() });

    await Promise.resolve();
    await Promise.resolve();

    expect(admissions).toEqual([{ from: 'user:user-grace', rooms: ['server:server-1'] }]);
  });

  it('announces the departure of a member who was in a call, whatever order the channels come back in', async () => {
    // `channelIdsIn` promises no particular order, so the eviction loop reaches a
    // channel with no call in it before the one holding the leaver's call.
    const { realtime, voice, sent } = buildHarness({ channelIds: ['channel-quiet', CHANNEL] });

    voice.join({
      serverId: 'server-1',
      channelId: CHANNEL,
      socketId: 'socket-1',
      user: message().author,
      canSpeak: true,
    });

    realtime.memberLeft({ serverId: 'server-1', userId: 'user-ada' });

    await Promise.resolve();
    await Promise.resolve();

    // Without the announcement everyone else keeps rendering them in the call for
    // as long as the channel stays open.
    expect(sent).toContainEqual({
      room: `channel:${CHANNEL}`,
      event: SocketEvent.VOICE_STATE_LEAVE,
      payload: { serverId: 'server-1', channelId: CHANNEL, userId: 'user-ada' },
    });
    expect(voice.participantsIn(CHANNEL)).toEqual([]);
  });

  it('leaves a call in another channel alone when evicting from one the user is not in', () => {
    const { realtime, voice, sent } = buildHarness();

    voice.join({
      serverId: 'server-1',
      channelId: CHANNEL,
      socketId: 'socket-1',
      user: message().author,
      canSpeak: true,
    });

    realtime.voiceEvict('channel-elsewhere', 'user-ada');

    expect(voice.participantsIn(CHANNEL)).toHaveLength(1);
    expect(sent).toEqual([]);
  });

  it('drops a broadcast rather than failing when no socket server is up', () => {
    // The API serves HTTP fine without websockets; a request must not fail because
    // nothing is listening.
    const { realtime } = buildHarness({ attach: false });

    expect(() => realtime.messageCreated(message())).not.toThrow();
  });
});
