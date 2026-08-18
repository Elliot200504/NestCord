import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_EVERYONE_PERMISSIONS,
  MAX_VOICE_PARTICIPANTS,
  Permission,
  SocketEvent,
} from '@nestcord/shared';

import type { AuthService } from '../auth/auth.service';
import type { MemberContext } from '../common/permissions/member-context';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import { EventsGateway } from './events.gateway';
import { PresenceService } from './presence.service';
import type { RealtimeService } from './realtime.service';
import type { SocketRooms } from './socket-rooms';
import { VoiceStateService } from './voice-state.service';

const SERVER = 'server-1';
const CHANNEL = 'channel-1';
const ADA = { id: 'user-ada', username: 'ada' };

interface Sent {
  room: string;
  event: string;
  payload: unknown;
}

/** A socket, as far as the gateway uses one. */
function fakeSocket(id: string, token: string | undefined, sent: Sent[]) {
  const joined: string[] = [];
  let disconnected = false;

  return {
    socket: {
      id,
      handshake: { auth: { token } },
      join: async (rooms: string[]) => void joined.push(...rooms),
      disconnect: () => {
        disconnected = true;
      },
      to: (room: string) => ({
        emit: (event: string, payload: unknown) => sent.push({ room, event, payload }),
      }),
    },
    joined,
    isDisconnected: () => disconnected,
  };
}

function buildHarness(
  options: {
    channelPermissions?: number;
    isMember?: boolean;
    channelType?: 'TEXT' | 'VOICE' | 'CATEGORY';
    channelExists?: boolean;
  } = {},
) {
  const {
    channelPermissions = DEFAULT_EVERYONE_PERMISSIONS,
    isMember = true,
    channelType = 'TEXT',
    channelExists = true,
  } = options;
  // Mutable so a test can take a permission away mid-connection, which is the whole
  // point of re-resolving per event.
  let current = channelPermissions;
  const sent: Sent[] = [];
  const announced: string[] = [];
  const voiceStates: unknown[] = [];
  const voiceLeaves: unknown[] = [];
  const relayed: { socketId: string; event: string; payload: unknown }[] = [];

  const auth = {
    authenticateAccessToken: async (token: string | undefined) => {
      if (token !== 'good-token') throw new UnauthorizedException('Invalid access token');

      return { ...ADA, displayName: null, avatarUrl: null, accentColor: null, status: 'ONLINE' };
    },
  } as unknown as AuthService;

  const prisma = {
    client: {
      channel: {
        findUnique: async () => (channelExists ? { serverId: SERVER, type: channelType } : null),
      },
      user: { findUnique: async () => ({ status: 'ONLINE' }) },
    },
  } as unknown as PrismaService;

  const permissions = {
    findMemberContext: async (): Promise<MemberContext | null> =>
      isMember
        ? {
            serverId: SERVER,
            memberId: 'member-1',
            userId: ADA.id,
            isOwner: false,
            permissions: current,
            roleIds: [],
            highestPosition: 0,
          }
        : null,
    resolveChannelPermissions: async () => current,
  } as unknown as PermissionsService;

  const realtime = {
    attach: () => {},
    announcePresence: async (userId: string) => void announced.push(userId),
    voiceStateChanged: (participant: unknown) => void voiceStates.push(participant),
    voiceStateLeft: (payload: unknown) => void voiceLeaves.push(payload),
    relayToSocket: (socketId: string, event: string, payload: unknown) =>
      void relayed.push({ socketId, event, payload }),
  } as unknown as RealtimeService;

  const socketRooms = {
    forUser: async () => [`user:${ADA.id}`, `server:${SERVER}`, `channel:${CHANNEL}`],
    serverIdsOf: async () => [SERVER],
  } as unknown as SocketRooms;

  const presence = new PresenceService();
  const voice = new VoiceStateService();

  return {
    gateway: new EventsGateway(auth, prisma, permissions, presence, realtime, socketRooms, voice),
    presence,
    voice,
    sent,
    announced,
    voiceStates,
    voiceLeaves,
    relayed,
    setChannelPermissions: (next: number) => {
      current = next;
    },
  };
}

describe('EventsGateway connection', () => {
  it('joins an authenticated socket to the rooms it may read', async () => {
    const { gateway } = buildHarness();
    const { socket, joined } = fakeSocket('socket-1', 'good-token', []);

    await gateway.handleConnection(socket as never);

    expect(joined).toEqual([`user:${ADA.id}`, `server:${SERVER}`, `channel:${CHANNEL}`]);
  });

  it('disconnects a socket with no token and joins it to nothing', async () => {
    const { gateway } = buildHarness();
    const { socket, joined, isDisconnected } = fakeSocket('socket-1', undefined, []);

    await gateway.handleConnection(socket as never);

    expect(isDisconnected()).toBe(true);
    expect(joined).toEqual([]);
  });

  it('disconnects a socket whose token is not ours', async () => {
    const { gateway } = buildHarness();
    const { socket, isDisconnected } = fakeSocket('socket-1', 'forged', []);

    await gateway.handleConnection(socket as never);

    expect(isDisconnected()).toBe(true);
  });

  it('announces presence for the first socket only', async () => {
    const { gateway, announced } = buildHarness();

    await gateway.handleConnection(fakeSocket('socket-1', 'good-token', []).socket as never);
    await gateway.handleConnection(fakeSocket('socket-2', 'good-token', []).socket as never);

    expect(announced).toEqual([ADA.id]);
  });

  it('announces going offline only when the last socket closes', async () => {
    const { gateway, announced } = buildHarness();
    const first = fakeSocket('socket-1', 'good-token', []);
    const second = fakeSocket('socket-2', 'good-token', []);

    await gateway.handleConnection(first.socket as never);
    await gateway.handleConnection(second.socket as never);

    await gateway.handleDisconnect(first.socket as never);
    expect(announced).toEqual([ADA.id]);

    await gateway.handleDisconnect(second.socket as never);
    expect(announced).toEqual([ADA.id, ADA.id]);
  });

  it('ignores a disconnect from a socket that never authenticated', async () => {
    const { gateway, announced } = buildHarness();
    const { socket } = fakeSocket('socket-9', 'forged', []);

    await gateway.handleDisconnect(socket as never);

    expect(announced).toEqual([]);
  });
});

describe('EventsGateway typing', () => {
  let harness: ReturnType<typeof buildHarness>;

  beforeEach(async () => {
    harness = buildHarness();
    await harness.gateway.handleConnection(
      fakeSocket('socket-1', 'good-token', []).socket as never,
    );
  });

  it('relays typing to the channel room, not back to the sender', async () => {
    const { socket } = fakeSocket('socket-1', 'good-token', harness.sent);

    await harness.gateway.handleTypingStart(socket as never, { channelId: CHANNEL });

    expect(harness.sent).toEqual([
      {
        room: `channel:${CHANNEL}`,
        event: SocketEvent.TYPING_START,
        payload: { channelId: CHANNEL, user: expect.objectContaining({ id: ADA.id }) },
      },
    ]);
  });

  it('relays a stop as its own event', async () => {
    const { socket } = fakeSocket('socket-1', 'good-token', harness.sent);

    await harness.gateway.handleTypingStop(socket as never, { channelId: CHANNEL });

    expect(harness.sent[0]?.event).toBe(SocketEvent.TYPING_STOP);
  });

  it('says nothing for a socket that never authenticated', async () => {
    const { socket } = fakeSocket('socket-unknown', 'good-token', harness.sent);

    await harness.gateway.handleTypingStart(socket as never, { channelId: CHANNEL });

    expect(harness.sent).toEqual([]);
  });

  it('refuses to relay typing from someone who cannot post there', async () => {
    // Being in the room is not enough: permissions are re-resolved per event, so a
    // member whose SEND_MESSAGES was taken away cannot appear to type.
    const denied = buildHarness({ channelPermissions: Permission.VIEW_CHANNEL });
    const connect = fakeSocket('socket-1', 'good-token', []);
    await denied.gateway.handleConnection(connect.socket as never);

    const { socket } = fakeSocket('socket-1', 'good-token', denied.sent);
    await denied.gateway.handleTypingStart(socket as never, { channelId: CHANNEL });

    expect(denied.sent).toEqual([]);
  });

  it('refuses to relay typing from someone who is no longer a member', async () => {
    const stranger = buildHarness({ isMember: false });
    const connect = fakeSocket('socket-1', 'good-token', []);
    await stranger.gateway.handleConnection(connect.socket as never);

    const { socket } = fakeSocket('socket-1', 'good-token', stranger.sent);
    await stranger.gateway.handleTypingStart(socket as never, { channelId: CHANNEL });

    expect(stranger.sent).toEqual([]);
  });
});

describe('EventsGateway voice', () => {
  const VOICE = 'channel-voice';

  /** A connected socket in a harness whose channel is a voice channel. */
  async function connectedTo(
    options: Parameters<typeof buildHarness>[0] = {},
    socketId = 'socket-1',
  ) {
    const harness = buildHarness({ channelType: 'VOICE', ...options });
    const connect = fakeSocket(socketId, 'good-token', harness.sent);
    await harness.gateway.handleConnection(connect.socket as never);

    return { ...harness, socket: connect.socket };
  }

  /** Somebody else already in the call, seeded directly. */
  function seedParticipant(voice: VoiceStateService, id: string, socketId: string) {
    voice.join({
      channelId: VOICE,
      socketId,
      user: {
        id,
        username: id,
        displayName: null,
        avatarUrl: null,
        accentColor: null,
        status: 'ONLINE',
      },
      canSpeak: true,
    });
  }

  it('lets a member with CONNECT join a voice channel', async () => {
    const { gateway, socket, voice, voiceStates } = await connectedTo();

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack).toEqual({ ok: true, participants: [] });
    expect(voice.isIn(VOICE, ADA.id)).toBe(true);
    expect(voiceStates).toHaveLength(1);
  });

  it('tells a joiner who is already in the call, so it knows who to offer to', async () => {
    const { gateway, socket, voice } = await connectedTo();
    seedParticipant(voice, 'user-grace', 'socket-grace');

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack.ok).toBe(true);
    expect(ack.ok && ack.participants.map((p) => p.user.id)).toEqual(['user-grace']);
  });

  it('refuses a join from someone without CONNECT', async () => {
    const { gateway, socket, voice, voiceStates } = await connectedTo({
      channelPermissions: Permission.VIEW_CHANNEL | Permission.SEND_MESSAGES,
    });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack).toEqual({ ok: false, reason: 'forbidden' });
    expect(voice.isIn(VOICE, ADA.id)).toBe(false);
    expect(voiceStates).toEqual([]);
  });

  it('refuses a join when the channel is not visible', async () => {
    // Losing VIEW_CHANNEL clears every other bit, so CONNECT cannot survive it.
    const { gateway, socket, voice } = await connectedTo({ channelPermissions: 0 });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack).toEqual({ ok: false, reason: 'forbidden' });
    expect(voice.isIn(VOICE, ADA.id)).toBe(false);
  });

  it('refuses a join from someone who is no longer a member', async () => {
    const { gateway, socket } = await connectedTo({ isMember: false });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('refuses a join aimed at a text channel', async () => {
    const { gateway, socket } = await connectedTo({ channelType: 'TEXT' });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: CHANNEL });

    expect(ack).toEqual({ ok: false, reason: 'not-voice' });
  });

  it('lets an administrator join without an explicit CONNECT', async () => {
    const { gateway, socket, voice } = await connectedTo({
      channelPermissions: Permission.ADMINISTRATOR | Permission.VIEW_CHANNEL,
    });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack.ok).toBe(true);
    expect(voice.isIn(VOICE, ADA.id)).toBe(true);
  });

  it('lets someone without SPEAK join as a listener', async () => {
    const { gateway, socket, voice } = await connectedTo({
      channelPermissions: Permission.VIEW_CHANNEL | Permission.CONNECT,
    });

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack.ok).toBe(true);
    expect(voice.participantsIn(VOICE)[0]).toMatchObject({ canSpeak: false });
  });

  it('refuses the ninth participant and announces nothing', async () => {
    const { gateway, socket, voice, voiceStates } = await connectedTo();

    for (let index = 0; index < MAX_VOICE_PARTICIPANTS; index += 1) {
      seedParticipant(voice, `user-${index}`, `socket-seed-${index}`);
    }

    const ack = await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    expect(ack).toEqual({ ok: false, reason: 'full' });
    expect(voice.countIn(VOICE)).toBe(MAX_VOICE_PARTICIPANTS);
    expect(voiceStates).toEqual([]);
  });

  it('ends the call when the tab closes', async () => {
    const { gateway, socket, voice, voiceLeaves } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    await gateway.handleDisconnect(socket as never);

    expect(voice.isIn(VOICE, ADA.id)).toBe(false);
    expect(voiceLeaves).toEqual([{ channelId: VOICE, userId: ADA.id }]);
  });

  it('ignores a mute that names a channel the socket is not in', async () => {
    const { gateway, socket, voice, voiceStates } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    await gateway.handleVoiceUpdate(socket as never, {
      channelId: 'channel-somewhere-else',
      selfMute: true,
      selfDeaf: false,
    });

    expect(voice.participantsIn(VOICE)[0]).toMatchObject({ selfMute: false });
    // Only the join was announced.
    expect(voiceStates).toHaveLength(1);
  });

  it('announces a mute', async () => {
    const { gateway, socket, voiceStates } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    await gateway.handleVoiceUpdate(socket as never, {
      channelId: VOICE,
      selfMute: true,
      selfDeaf: false,
    });

    expect(voiceStates.at(-1)).toMatchObject({ selfMute: true, selfDeaf: false });
  });

  it('relays an offer to exactly the target socket', async () => {
    const { gateway, socket, voice, relayed } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });
    seedParticipant(voice, 'user-grace', 'socket-grace');

    await gateway.handleVoiceOffer(socket as never, {
      channelId: VOICE,
      targetUserId: 'user-grace',
      sdp: 'v=0',
    });

    expect(relayed).toEqual([
      {
        socketId: 'socket-grace',
        event: SocketEvent.VOICE_OFFER,
        payload: {
          sdp: 'v=0',
          channelId: VOICE,
          targetUserId: 'user-grace',
          fromUserId: ADA.id,
        },
      },
    ]);
  });

  it('drops a signal naming a channel the sender is not in', async () => {
    const { gateway, socket, voice, relayed } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });
    seedParticipant(voice, 'user-grace', 'socket-grace');

    await gateway.handleVoiceOffer(socket as never, {
      channelId: 'channel-not-mine',
      targetUserId: 'user-grace',
      sdp: 'v=0',
    });

    expect(relayed).toEqual([]);
  });

  it('drops a signal from someone who is in no call at all', async () => {
    const { gateway, socket, voice, relayed } = await connectedTo();
    seedParticipant(voice, 'user-grace', 'socket-grace');

    await gateway.handleVoiceOffer(socket as never, {
      channelId: VOICE,
      targetUserId: 'user-grace',
      sdp: 'v=0',
    });

    expect(relayed).toEqual([]);
  });

  it('drops a signal aimed at someone who is not in the call', async () => {
    const { gateway, socket, relayed } = await connectedTo();
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });

    await gateway.handleVoiceOffer(socket as never, {
      channelId: VOICE,
      targetUserId: 'user-nowhere',
      sdp: 'v=0',
    });

    expect(relayed).toEqual([]);
  });

  it('drops a signal once the sender has lost CONNECT', async () => {
    const { gateway, socket, voice, relayed, setChannelPermissions } = await connectedTo({
      channelPermissions: Permission.VIEW_CHANNEL | Permission.CONNECT,
    });
    await gateway.handleVoiceJoin(socket as never, { channelId: VOICE });
    seedParticipant(voice, 'user-grace', 'socket-grace');

    // Permissions are re-resolved per event, so a connection that was allowed to join
    // stops being allowed to signal the moment the override lands.
    setChannelPermissions(Permission.VIEW_CHANNEL);

    await gateway.handleVoiceOffer(socket as never, {
      channelId: VOICE,
      targetUserId: 'user-grace',
      sdp: 'v=0',
    });

    expect(relayed).toEqual([]);
  });
});
