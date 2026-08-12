import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { PresenceService } from './presence.service';
import { SocketRooms } from './socket-rooms';
import {
  rooms,
  SocketEvent,
  type Message,
  type MemberJoinPayload,
  type MemberLeavePayload,
  type MessageDeletePayload,
  type NotificationPayload,
  type PresencePayload,
  type ReactionPayload,
  type TypingPayload,
} from '@nestcord/shared';

/**
 * The one way anything broadcasts.
 *
 * Services call this after they have written to the database — write first, broadcast
 * second, so nobody is told about a change that failed to persist. It is separate from
 * `EventsGateway` on purpose: the gateway owns connections and incoming events, this
 * owns outgoing ones, and services depend only on the latter. That also keeps the
 * dependency one-way, so no module ends up importing the gateway to send a message.
 *
 * Every method is safe to call before a socket server exists — the API serves HTTP
 * fine without one, and a broadcast into the void must not fail a request.
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  constructor(
    private readonly presence: PresenceService,
    private readonly rooms: SocketRooms,
  ) {}

  /** Handed the server by the gateway once Socket.IO is up. */
  attach(server: Server): void {
    this.server = server;
  }

  messageCreated(message: Message): void {
    this.emit(rooms.channel(message.channelId), SocketEvent.MESSAGE_CREATE, message);
  }

  messageUpdated(message: Message): void {
    this.emit(rooms.channel(message.channelId), SocketEvent.MESSAGE_UPDATE, message);
  }

  messageDeleted(payload: MessageDeletePayload): void {
    this.emit(rooms.channel(payload.channelId), SocketEvent.MESSAGE_DELETE, payload);
  }

  reactionAdded(payload: ReactionPayload): void {
    this.emit(rooms.channel(payload.channelId), SocketEvent.REACTION_ADD, payload);
  }

  reactionRemoved(payload: ReactionPayload): void {
    this.emit(rooms.channel(payload.channelId), SocketEvent.REACTION_REMOVE, payload);
  }

  /** Relayed to the channel, minus the person doing the typing. */
  typing(payload: TypingPayload, starting: boolean): void {
    this.emit(
      rooms.channel(payload.channelId),
      starting ? SocketEvent.TYPING_START : SocketEvent.TYPING_STOP,
      payload,
    );
  }

  /**
   * Presence goes to the servers the user shares with people, not to everyone
   * connected — someone who shares no server with you has no business knowing when
   * you come online.
   */
  presenceChanged(serverIds: string[], payload: PresencePayload): void {
    for (const serverId of serverIds) {
      this.emit(rooms.server(serverId), SocketEvent.PRESENCE_UPDATE, payload);
    }
  }

  /**
   * Tells the people who share a server with this user what their presence now is.
   *
   * Both the socket lifecycle and the status route end here, so "who can see my
   * presence" is decided in one place rather than two.
   */
  async announcePresence(userId: string): Promise<void> {
    const serverIds = await this.rooms.serverIdsOf(userId);

    this.presenceChanged(serverIds, { userId, status: this.presence.statusOf(userId) });
  }

  memberJoined(payload: MemberJoinPayload): void {
    this.emit(rooms.server(payload.serverId), SocketEvent.MEMBER_JOIN, payload);
  }

  memberLeft(payload: MemberLeavePayload): void {
    this.emit(rooms.server(payload.serverId), SocketEvent.MEMBER_LEAVE, payload);
  }

  /** Aimed at one person, on every device they have open. */
  notify(userId: string, payload: NotificationPayload): void {
    this.emit(rooms.user(userId), SocketEvent.NOTIFICATION_CREATE, payload);
  }

  private emit(room: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(`No socket server yet; dropped ${event}`);

      return;
    }

    this.server.to(room).emit(event, payload);
  }
}
