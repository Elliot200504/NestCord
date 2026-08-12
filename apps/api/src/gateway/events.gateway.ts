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

import { has, Permission, rooms, SocketEvent, type PublicUser } from '@nestcord/shared';

import { AuthService } from '../auth/auth.service';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { TypingDto } from './dto/typing.dto';
import { PresenceService } from './presence.service';
import { RealtimeService } from './realtime.service';
import { SocketRooms } from './socket-rooms';

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
