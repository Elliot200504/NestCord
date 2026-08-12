import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import {
  SocketEvent,
  type MemberJoinPayload,
  type MemberLeavePayload,
  type Message,
  type MessageDeletePayload,
  type NotificationPayload,
  type PresencePayload,
  type ReactionPayload,
  type TypingPayload,
} from '@nestcord/shared';

import { keys } from '@/api/keys';
import {
  applyReaction,
  patchMessage,
  removeMessage,
  upsertMessage,
} from '@/features/messages/message-cache';
import { useTypingStore } from '@/stores/typing-store';

/**
 * Every socket listener, in one place.
 *
 * Registered once at app level rather than per component — a listener mounted with a
 * component fires once per mounted copy, which is how a realtime UI ends up appending
 * the same message three times.
 *
 * The split is deliberate: high-frequency events patch the cache directly, because
 * refetching a channel on every message would undo the point of a socket. Structural
 * changes — who is in a server — invalidate instead, since they are rare and the
 * server is the authority on ordering and permissions.
 */
export function registerRealtimeListeners(
  socket: Socket,
  queryClient: QueryClient,
  viewerId: string,
): () => void {
  const onMessageCreate = (message: Message) => {
    upsertMessage(queryClient, message.channelId, message);
  };

  const onMessageUpdate = (message: Message) => {
    patchMessage(queryClient, message.channelId, message.id, (current) => ({
      ...message,
      // The sender's own `me` flags are theirs; the broadcast cannot know them.
      reactions: current.reactions,
    }));
  };

  const onMessageDelete = (payload: MessageDeletePayload) => {
    removeMessage(queryClient, payload.channelId, payload.messageId);
  };

  const onReaction = (added: boolean) => (payload: ReactionPayload) => {
    patchMessage(queryClient, payload.channelId, payload.messageId, (current) =>
      applyReaction(current, payload.emoji, payload.userId, viewerId, added),
    );
  };

  const onTypingStart = (payload: TypingPayload) => {
    useTypingStore.getState().start(payload.channelId, payload.user, Date.now());
  };

  const onTypingStop = (payload: TypingPayload) => {
    useTypingStore.getState().stop(payload.channelId, payload.user.id);
  };

  /**
   * Presence is patched across every loaded member list rather than invalidating
   * them: someone going idle should not cost a request per server you share.
   */
  const onPresence = (payload: PresencePayload) => {
    queryClient.setQueriesData<Array<{ user: { id: string; status: string } }>>(
      { queryKey: ['servers'], exact: false },
      (members) => {
        if (!Array.isArray(members)) return members;

        return members.map((member) =>
          member.user?.id === payload.userId
            ? { ...member, user: { ...member.user, status: payload.status } }
            : member,
        );
      },
    );
  };

  const onMemberJoin = (payload: MemberJoinPayload) => {
    void queryClient.invalidateQueries({ queryKey: keys.members(payload.serverId) });
  };

  const onMemberLeave = (payload: MemberLeavePayload) => {
    void queryClient.invalidateQueries({ queryKey: keys.members(payload.serverId) });
  };

  const onNotification = (payload: NotificationPayload) => {
    queryClient.setQueryData<NotificationPayload[]>(keys.notifications, (current) => [
      payload,
      ...(current ?? []),
    ]);
  };

  /**
   * A reconnect means time passed with nobody listening, so anything that changed in
   * the gap is missing. The message pages and member lists are re-read; this is the
   * one place invalidation is the right answer for messages.
   */
  const onConnect = () => {
    void queryClient.invalidateQueries({ queryKey: ['messages'] });
    void queryClient.invalidateQueries({ queryKey: ['servers'] });
    void queryClient.invalidateQueries({ queryKey: keys.notifications });
  };

  const onDisconnect = () => {
    // Nobody is typing as far as we know any more; keeping stale indicators up would
    // leave someone "typing" forever.
    useTypingStore.getState().clear();
  };

  socket.on(SocketEvent.MESSAGE_CREATE, onMessageCreate);
  socket.on(SocketEvent.MESSAGE_UPDATE, onMessageUpdate);
  socket.on(SocketEvent.MESSAGE_DELETE, onMessageDelete);
  socket.on(SocketEvent.REACTION_ADD, onReaction(true));
  socket.on(SocketEvent.REACTION_REMOVE, onReaction(false));
  socket.on(SocketEvent.TYPING_START, onTypingStart);
  socket.on(SocketEvent.TYPING_STOP, onTypingStop);
  socket.on(SocketEvent.PRESENCE_UPDATE, onPresence);
  socket.on(SocketEvent.MEMBER_JOIN, onMemberJoin);
  socket.on(SocketEvent.MEMBER_LEAVE, onMemberLeave);
  socket.on(SocketEvent.NOTIFICATION_CREATE, onNotification);
  socket.on('connect', onConnect);
  socket.on('disconnect', onDisconnect);

  return () => {
    socket.off(SocketEvent.MESSAGE_CREATE, onMessageCreate);
    socket.off(SocketEvent.MESSAGE_UPDATE, onMessageUpdate);
    socket.off(SocketEvent.MESSAGE_DELETE, onMessageDelete);
    socket.off(SocketEvent.REACTION_ADD);
    socket.off(SocketEvent.REACTION_REMOVE);
    socket.off(SocketEvent.TYPING_START, onTypingStart);
    socket.off(SocketEvent.TYPING_STOP, onTypingStop);
    socket.off(SocketEvent.PRESENCE_UPDATE, onPresence);
    socket.off(SocketEvent.MEMBER_JOIN, onMemberJoin);
    socket.off(SocketEvent.MEMBER_LEAVE, onMemberLeave);
    socket.off(SocketEvent.NOTIFICATION_CREATE, onNotification);
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
  };
}
