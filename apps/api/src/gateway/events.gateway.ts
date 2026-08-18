import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

import {
  has,
  Permission,
  rooms,
  SocketEvent,
  type PublicUser,
  type VoiceJoinAck,
} from '@nestcord/shared';

import { AuthService } from '../auth/auth.service';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TypingDto } from './dto/typing.dto';
import {
  VoiceCandidateDto,
  VoiceDescriptionDto,
  VoiceJoinDto,
  VoiceUpdateDto,
} from './dto/voice.dto';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import { SocketRooms } from './socket-rooms';
import { VoiceStateService } from './voice-state.service';

/** What we keep on each authenticated socket. */
interface SocketState {
  user: PublicUser;
}

/**
 * The single Socket.IO server (PLAN.MD §6). One process, in-memory state, no Redis
 * adapter — a few hundred users do not need one, and adding one would mean running
 * more than one API instance, which this project explicitly does not do.
 *
 * The handshake is where authorization happens: the token is verified, the user's
 * rooms are resolved from the database, and only then is the socket joined to them.
 * A socket that fails any of that is disconnected rather than left half-joined.
 */
@WebSocketGateway({
  namespace: '/realtime',
  // Same origin rule as the REST API; the value comes from the adapter's CORS config
  // in main.ts, so there is one place to change it.
  cors: false,
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventsGateway.name);
  private readonly states = new Map<string, SocketState>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly presence: PresenceService,
    private readonly realtime: RealtimeService,
    private readonly socketRooms: SocketRooms,
    private readonly voice: VoiceStateService,
  ) {}

  /**
   * Authenticate, join rooms, announce presence — in that order.
   *
   * The token comes from the handshake auth payload rather than a query string,
   * because query strings end up in proxy and server logs.
   */
  async handleConnection(socket: Socket): Promise<void> {
    this.realtime.attach(this.server);

    try {
      const token = socket.handshake.auth?.token as string | undefined;
      const user = await this.auth.authenticateAccessToken(token);

      const chosen = await this.chosenStatus(user.id);
      const joinable = await this.socketRooms.forUser(user.id);

      await socket.join(joinable);
      this.states.set(socket.id, { user });

      // Only the first socket is news; a second tab changes nothing anyone can see.
      if (this.presence.connect(user.id, socket.id, chosen)) {
        await this.realtime.announcePresence(user.id);
      }

      this.logger.debug(`${user.username} connected (${joinable.length} rooms)`);
    } catch {
      // Never say why: an unauthenticated socket gets nothing but a closed connection.
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: Socket): Promise<void> {
    const state = this.states.get(socket.id);

    if (!state) return;

    this.states.delete(socket.id);

    // A closed tab never sends `voice:leave`, so the disconnect is what ends a call.
    const left = this.voice.leaveSocket(socket.id);

    if (left) this.realtime.voiceStateLeft(left);

    if (this.presence.disconnect(state.user.id, socket.id)) {
      await this.realtime.announcePresence(state.user.id);
    }
  }

  /**
   * Relayed, never stored. VIEW_CHANNEL and SEND_MESSAGES are both checked: someone
   * who cannot post in a channel has no business appearing to type in it.
   */
  @SubscribeMessage(SocketEvent.TYPING_START)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleTypingStart(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: TypingDto,
  ): Promise<void> {
    await this.relayTyping(socket, dto, true);
  }

  @SubscribeMessage(SocketEvent.TYPING_STOP)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleTypingStop(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: TypingDto,
  ): Promise<void> {
    await this.relayTyping(socket, dto, false);
  }

  /**
   * Joining a call, answered through an ack callback rather than a broadcast.
   *
   * This is the only handler here that replies to the sender: a client cannot open a
   * microphone hopefully and discover afterwards that it was refused, and "the channel
   * is full" has to arrive as an answer to *this* request. On success the ack carries
   * everybody already in the call, who the joiner then sends offers to.
   */
  @SubscribeMessage(SocketEvent.VOICE_JOIN)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleVoiceJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: VoiceJoinDto,
  ): Promise<VoiceJoinAck> {
    const state = this.states.get(socket.id);

    if (!state) return { ok: false, reason: 'forbidden' };

    const channel = await this.prisma.client.channel.findUnique({
      where: { id: dto.channelId },
      select: { serverId: true, type: true },
    });

    if (!channel) return { ok: false, reason: 'forbidden' };
    if (channel.type !== 'VOICE') return { ok: false, reason: 'not-voice' };

    const member = await this.permissions.findMemberContext(channel.serverId, state.user.id);

    if (!member) return { ok: false, reason: 'forbidden' };

    const permissions = await this.permissions
      .resolveChannelPermissions(member, dto.channelId)
      .catch(() => 0);

    // A channel you cannot see resolves to nothing at all, so CONNECT covers both.
    if (!has(permissions, Permission.CONNECT)) return { ok: false, reason: 'forbidden' };

    // Everybody already there, read before this socket is added to them.
    const participants = this.voice.participantsIn(dto.channelId);

    // One call at a time: joining a second channel leaves the first, and the people
    // left behind are told so their meshes drop the peer.
    const previous = this.voice.locationOf(socket.id);

    if (previous && previous.channelId !== dto.channelId) {
      this.voice.leaveSocket(socket.id);
      this.realtime.voiceStateLeft(previous);
    }

    const joined = this.voice.join({
      channelId: dto.channelId,
      socketId: socket.id,
      user: state.user,
      canSpeak: has(permissions, Permission.SPEAK),
    });

    if (!joined.ok) return { ok: false, reason: joined.reason };

    const self = this.voice
      .participantsIn(dto.channelId)
      .find((participant) => participant.user.id === state.user.id);

    if (self) this.realtime.voiceStateChanged(self);

    return { ok: true, participants };
  }

  /** Leaves whichever call this socket is in — never the one the payload names. */
  @SubscribeMessage(SocketEvent.VOICE_LEAVE)
  async handleVoiceLeave(@ConnectedSocket() socket: Socket): Promise<void> {
    const left = this.voice.leaveSocket(socket.id);

    if (left) this.realtime.voiceStateLeft(left);
  }

  /** A mute or a deafen, which everyone who can see the channel gets to see. */
  @SubscribeMessage(SocketEvent.VOICE_UPDATE)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleVoiceUpdate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: VoiceUpdateDto,
  ): Promise<void> {
    const location = this.voice.locationOf(socket.id);

    // The payload's channel is only accepted when it agrees with where the server
    // has this socket; otherwise the client is describing a call it is not in.
    if (!location || location.channelId !== dto.channelId) return;

    const updated = this.voice.update(socket.id, {
      selfMute: dto.selfMute,
      selfDeaf: dto.selfDeaf,
    });

    if (updated) this.realtime.voiceStateChanged(updated);
  }

  @SubscribeMessage(SocketEvent.VOICE_OFFER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleVoiceOffer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: VoiceDescriptionDto,
  ): Promise<void> {
    await this.relaySignal(socket, dto, SocketEvent.VOICE_OFFER, { sdp: dto.sdp });
  }

  @SubscribeMessage(SocketEvent.VOICE_ANSWER)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleVoiceAnswer(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: VoiceDescriptionDto,
  ): Promise<void> {
    await this.relaySignal(socket, dto, SocketEvent.VOICE_ANSWER, { sdp: dto.sdp });
  }

  @SubscribeMessage(SocketEvent.VOICE_CANDIDATE)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  async handleVoiceCandidate(
    @ConnectedSocket() socket: Socket,
    @MessageBody() dto: VoiceCandidateDto,
  ): Promise<void> {
    await this.relaySignal(socket, dto, SocketEvent.VOICE_CANDIDATE, {
      candidate: dto.candidate,
      sdpMid: dto.sdpMid,
      sdpMLineIndex: dto.sdpMLineIndex,
    });
  }

  /**
   * Passes one signalling message to one other participant.
   *
   * The channel is taken from what the server recorded for this socket, not from what
   * the payload claims — otherwise a client could name any channel, including one it
   * cannot see, and push SDP at whoever is in it. The target must be in that same
   * call, and CONNECT is re-resolved because a long-lived connection's permissions
   * can change under it. Anything that fails is dropped in silence: a signalling
   * relay owes a misbehaving client no explanation.
   */
  private async relaySignal(
    socket: Socket,
    dto: { channelId: string; targetUserId: string },
    event: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const state = this.states.get(socket.id);
    const location = this.voice.locationOf(socket.id);

    if (!state || !location || location.channelId !== dto.channelId) return;
    if (dto.targetUserId === state.user.id) return;

    const targetSocketId = this.voice.socketIdOf(location.channelId, dto.targetUserId);

    if (!targetSocketId) return;
    if (!(await this.canConnectTo(state.user.id, location.channelId))) return;

    this.realtime.relayToSocket(targetSocketId, event, {
      ...payload,
      channelId: location.channelId,
      targetUserId: dto.targetUserId,
      fromUserId: state.user.id,
    });
  }

  /** Re-resolves CONNECT in that channel, from the database. */
  private async canConnectTo(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.client.channel.findUnique({
      where: { id: channelId },
      select: { serverId: true },
    });

    if (!channel) return false;

    const member = await this.permissions.findMemberContext(channel.serverId, userId);

    if (!member) return false;

    const permissions = await this.permissions
      .resolveChannelPermissions(member, channelId)
      .catch(() => 0);

    return has(permissions, Permission.CONNECT);
  }

  private async relayTyping(socket: Socket, dto: TypingDto, starting: boolean): Promise<void> {
    const state = this.states.get(socket.id);

    if (!state) return;

    // Being in the room is not enough on its own — permissions can change during a
    // connection, so this is re-resolved per event like an HTTP route would.
    if (!(await this.canSendIn(state.user.id, dto.channelId))) return;

    // Broadcast, not emit: the sender does not need to be told they are typing.
    socket
      .to(rooms.channel(dto.channelId))
      .emit(starting ? SocketEvent.TYPING_START : SocketEvent.TYPING_STOP, {
        channelId: dto.channelId,
        user: state.user,
      });
  }

  /** Re-resolves SEND_MESSAGES in that channel, from the database. */
  private async canSendIn(userId: string, channelId: string): Promise<boolean> {
    const channel = await this.prisma.client.channel.findUnique({
      where: { id: channelId },
      select: { serverId: true },
    });

    if (!channel) return false;

    const member = await this.permissions.findMemberContext(channel.serverId, userId);

    if (!member) return false;

    const permissions = await this.permissions
      .resolveChannelPermissions(member, channelId)
      .catch(() => 0);

    return has(permissions, Permission.SEND_MESSAGES);
  }

  /** The status the user picked, which lives on their row. */
  private async chosenStatus(userId: string) {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { status: true },
    });

    return user?.status ?? 'ONLINE';
  }
}
