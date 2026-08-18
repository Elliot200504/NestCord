import { UnauthorizedException } from '@nestjs/common';
import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_EVERYONE_PERMISSIONS, Permission, SocketEvent } from '@nestcord/shared';

import type { AuthService } from '../auth/auth.service';
import type { MemberContext } from '../common/permissions/member-context';
import type { PermissionsService } from '../common/permissions/permissions.service';
import type { PrismaService } from '../common/prisma/prisma.service';
import { EventsGateway } from './events.gateway';
import { PresenceService } from './presence.service';
import type { RealtimeService } from './realtime.service';
import { VoiceStateService } from './voice-state.service';
import type { SocketRooms } from './socket-rooms';

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

function buildHarness(options: { channelPermissions?: number; isMember?: boolean } = {}) {
  const { channelPermissions = DEFAULT_EVERYONE_PERMISSIONS, isMember = true } = options;
  const sent: Sent[] = [];
  const announced: string[] = [];

  const auth = {
    authenticateAccessToken: async (token: string | undefined) => {
      if (token !== 'good-token') throw new UnauthorizedException('Invalid access token');

      return { ...ADA, displayName: null, avatarUrl: null, accentColor: null, status: 'ONLINE' };
    },
  } as unknown as AuthService;

  const prisma = {
    client: {
      channel: { findUnique: async () => ({ serverId: SERVER }) },
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
            permissions: channelPermissions,
            roleIds: [],
            highestPosition: 0,
          }
        : null,
    resolveChannelPermissions: async () => channelPermissions,
  } as unknown as PermissionsService;

  const realtime = {
    attach: () => {},
    announcePresence: async (userId: string) => void announced.push(userId),
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
