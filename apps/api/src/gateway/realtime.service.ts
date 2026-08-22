import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

import { PresenceService } from './presence.service';
import { SocketRooms } from './socket-rooms';
import { VoiceStateService } from './voice-state.service';
import {
  messageRoom,
  rooms,
  SocketEvent,
  type Conversation,
  type Message,
  type MemberJoinPayload,
  type MemberLeavePayload,
  type MessageDeletePayload,
  type MessageTarget,
  type NotificationPayload,
  type PresencePayload,
  type ReactionPayload,
  type TypingPayload,
  type VoiceLeavePayload,
  type VoiceParticipant,
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
    private readonly voice: VoiceStateService,
  ) {}

  /** Handed the server by the gateway once Socket.IO is up. */
  attach(server: Server): void {
    this.server = server;
  }

  // Message events are aimed by `messageRoom`, so the same call reaches a channel or
  // a DM depending on which of the two the message belongs to — the caller does not
  // have to know, and cannot aim a DM at a channel room by mistake.
  messageCreated(message: Message): void {
    this.emitToMessage(message, SocketEvent.MESSAGE_CREATE, message);
  }

  messageUpdated(message: Message): void {
    this.emitToMessage(message, SocketEvent.MESSAGE_UPDATE, message);
  }

  messageDeleted(payload: MessageDeletePayload): void {
    this.emitToMessage(payload, SocketEvent.MESSAGE_DELETE, payload);
  }

  reactionAdded(payload: ReactionPayload): void {
    this.emitToMessage(payload, SocketEvent.REACTION_ADD, payload);
  }

  reactionRemoved(payload: ReactionPayload): void {
    this.emitToMessage(payload, SocketEvent.REACTION_REMOVE, payload);
  }

  /**
   * A new DM, announced to everyone in it.
   *
   * Their sockets are joined to the conversation's room first: rooms are resolved at
   * connect time, so without this the other participants would not receive a message
   * in a conversation created after they connected — until they next reloaded.
   */
  async conversationCreated(conversation: Conversation): Promise<void> {
    const room = rooms.dm(conversation.id);

    for (const participant of conversation.participants) {
      await this.server?.in(rooms.user(participant.id)).socketsJoin(room);

      this.emit(rooms.user(participant.id), SocketEvent.CONVERSATION_CREATE, conversation);
    }
  }

  /** Takes a leaver's sockets out of the room, so the DM stops reaching them at once. */
  async conversationLeft(conversationId: string, userId: string): Promise<void> {
    await this.server?.in(rooms.user(userId)).socketsLeave(rooms.dm(conversationId));
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

  /**
   * Somebody joined a server.
   *
   * The people already there hear about it, and the new member's sockets are put into
   * the server's rooms. Rooms are resolved at connect time, so without this a member
   * who joined in one tab would receive nothing from that server — no messages, no
   * presence, no member list changes — until they next reloaded. It is the mirror
   * image of what `memberLeft` does, for the same reason `conversationCreated`
   * already does it for a DM.
   */
  memberJoined(payload: MemberJoinPayload): void {
    // Broadcast first, so the new member is not handed news of their own arrival.
    this.emit(rooms.server(payload.serverId), SocketEvent.MEMBER_JOIN, payload);

    this.admitToServer(payload.serverId, payload.member.user.id);
  }

  /**
   * Puts a user's sockets into a server's rooms without announcing anything.
   *
   * Called on its own when somebody creates a server: they are the only member, so
   * there is nobody to tell, but their own sockets still have to be let in or the
   * server they just made would be silent for them until a reload.
   */
  admitToServer(serverId: string, userId: string): void {
    // Deliberately not awaited: the membership itself is already committed, and the
    // caller must not fail because a socket could not be moved.
    void this.joinServerRooms(serverId, userId);
  }

  /**
   * Somebody is no longer a member — they left, or were kicked or banned.
   *
   * The people still there hear about it, and the departing user's sockets are put out
   * of the server's rooms. Without that, room membership would keep saying they may
   * read this server until they happen to reconnect, and moderation that leaves the
   * removed member still receiving messages has not really removed them.
   */
  memberLeft(payload: MemberLeavePayload): void {
    this.emit(rooms.server(payload.serverId), SocketEvent.MEMBER_LEAVE, payload);

    // Deliberately not awaited: the removal itself is already committed, and the
    // caller must not fail because a socket could not be moved.
    void this.evictFromServer(payload.serverId, payload.userId);
  }

  /**
   * Somebody joined a voice channel, muted, or deafened.
   *
   * Sent to the channel room, which is already the "who may see this channel"
   * boundary — so people who are not in the call still see who is, and nobody who
   * cannot see the channel learns anything.
   */
  voiceStateChanged(participant: VoiceParticipant): void {
    this.emit(rooms.channel(participant.channelId), SocketEvent.VOICE_STATE, participant);
  }

  voiceStateLeft(payload: VoiceLeavePayload): void {
    this.emit(rooms.channel(payload.channelId), SocketEvent.VOICE_STATE_LEAVE, payload);
  }

  /**
   * Relays one signalling message to a single socket.
   *
   * Aimed at a socket id rather than the target's user room on purpose: the call
   * lives in one tab, and copying an offer to that person's other tabs would have
   * each of them answer it.
   */
  relayToSocket(socketId: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(`No socket server yet; dropped ${event}`);

      return;
    }

    this.server.to(socketId).emit(event, payload);
  }

  /**
   * Drops a user out of a voice channel and tells the channel.
   *
   * Used when someone loses the right to be in the call rather than choosing to
   * leave it. Their own client tears the mesh down when it sees the leave — and once
   * peer connections are established the server has no other way to reach them,
   * which is why every path that can remove the right calls this.
   */
  voiceEvict(channelId: string, userId: string): void {
    const left = this.voice.leaveUser(userId);

    // `leaveUser` searches every channel, so check it was the one we meant.
    if (!left || left.channelId !== channelId) return;

    this.voiceStateLeft(left);
  }

  /** Aimed at one person, on every device they have open. */
  notify(userId: string, payload: NotificationPayload): void {
    this.emit(rooms.user(userId), SocketEvent.NOTIFICATION_CREATE, payload);
  }

  /**
   * Puts every socket this user has into a server's room and the rooms of the
   * channels they can see in it.
   *
   * Resolved through `visibleChannelIds`, so a channel an override hides from them
   * is not joined: room membership is the read boundary, and a new member must not
   * land in a room they would not have been given at connect time.
   */
  private async joinServerRooms(serverId: string, userId: string): Promise<void> {
    if (!this.server) return;

    try {
      const channelIds = await this.rooms.visibleChannelIds(userId, [serverId]);

      await this.server
        .in(rooms.user(userId))
        .socketsJoin([rooms.server(serverId), ...channelIds.map(rooms.channel)]);
    } catch (error) {
      this.logger.error(
        `Could not add ${userId} to the rooms of server ${serverId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Takes every socket this user has out of the server room and its channel rooms.
   * Their own user room stays: it is how they are told anything at all.
   */
  private async evictFromServer(serverId: string, userId: string): Promise<void> {
    if (!this.server) return;

    try {
      const channelIds = await this.rooms.channelIdsIn(serverId);

      // A kicked member with peer connections already up keeps talking otherwise:
      // signalling has stopped, so no later event would ever catch them.
      for (const channelId of channelIds) {
        this.voiceEvict(channelId, userId);
      }

      this.server
        .in(rooms.user(userId))
        .socketsLeave([rooms.server(serverId), ...channelIds.map(rooms.channel)]);
    } catch (error) {
      this.logger.error(
        `Could not remove ${userId} from the rooms of server ${serverId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Drops the event when the target names neither a channel nor a conversation. */
  private emitToMessage(target: MessageTarget, event: string, payload: unknown): void {
    const room = messageRoom(target);

    if (!room) {
      this.logger.warn(`${event} had no channel or conversation; dropped`);

      return;
    }

    this.emit(room, event, payload);
  }

  private emit(room: string, event: string, payload: unknown): void {
    if (!this.server) {
      this.logger.debug(`No socket server yet; dropped ${event}`);

      return;
    }

    this.server.to(room).emit(event, payload);
  }
}
