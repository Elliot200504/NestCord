import type { QueryClient } from '@tanstack/react-query';
import type { Socket } from 'socket.io-client';

import {
  messageTargetId,
  SocketEvent,
  type Conversation,
  type MemberJoinPayload,
  type MemberLeavePayload,
  type Message,
  type MessageDeletePayload,
  type NotificationPayload,
  type PresencePayload,
  type ReactionPayload,
  type TypingPayload,
  type VoiceLeavePayload,
  type VoiceParticipant,
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
  // Channel messages and DMs arrive on the same events and land in the same cache,
  // keyed by whichever of the two ids the payload carries.
  const onMessageCreate = (message: Message) => {
    const listId = messageTargetId(message);
    if (!listId) return;

    upsertMessage(queryClient, listId, message);

    // A DM moves its conversation to the top of the list, and the list is the only
    // thing that knows the order — so it is re-read rather than reordered here.
    if (message.conversationId) {
      void queryClient.invalidateQueries({ queryKey: keys.conversations });
    }
  };

  const onMessageUpdate = (message: Message) => {
    const listId = messageTargetId(message);
    if (!listId) return;

    patchMessage(queryClient, listId, message.id, (current) => ({
      ...message,
      // The sender's own `me` flags are theirs; the broadcast cannot know them.
      reactions: current.reactions,
    }));
  };

  const onMessageDelete = (payload: MessageDeletePayload) => {
    const listId = messageTargetId(payload);
    if (!listId) return;

    removeMessage(queryClient, listId, payload.messageId);
  };

  const onReaction = (added: boolean) => (payload: ReactionPayload) => {
    const listId = messageTargetId(payload);
    if (!listId) return;

    patchMessage(queryClient, listId, payload.messageId, (current) =>
      applyReaction(current, payload.emoji, payload.userId, viewerId, added),
    );
  };

  /**
   * Someone opened a DM with you, or added you to a group.
   *
   * The server has already put this socket in the conversation's room, so messages
   * will arrive from here on; this is what puts the conversation in the sidebar.
   */
  const onConversationCreate = (conversation: Conversation) => {
    queryClient.setQueryData(keys.conversation(conversation.id), conversation);

    void queryClient.invalidateQueries({ queryKey: keys.conversations });
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

    // When the member who left is us, we were kicked or banned: the server is gone
    // from our rail, and its cached entry has to go with it so nothing renders a
    // server we can no longer read.
    if (payload.userId === viewerId) {
      queryClient.removeQueries({ queryKey: keys.server(payload.serverId) });
      void queryClient.invalidateQueries({ queryKey: keys.servers });
    }
  };

  const onNotification = (payload: NotificationPayload) => {
    queryClient.setQueryData<NotificationPayload[]>(keys.notifications, (current) => [
      payload,
      ...(current ?? []),
    ]);

    // A friend request changes the friends list too, and the notification is the only
    // event that says so — so the list is re-read rather than given an event of its own.
    if (payload.type === 'FRIEND_REQUEST') {
      void queryClient.invalidateQueries({ queryKey: keys.friends });
    }
  };

  /**
   * Somebody joined a call, muted, or deafened.
   *
   * Patched rather than invalidated: a mute is as frequent as typing, and re-reading a
   * server's voice state for each one would defeat the point of the event. The payload
   * names its server, so exactly one cached list is touched — patching by prefix would
   * add the person to every server whose list happens to be loaded.
   */
  const onVoiceState = (payload: VoiceParticipant) => {
    queryClient.setQueryData<VoiceParticipant[]>(
      keys.voiceStates(payload.serverId),
      (states) => {
        const others = (states ?? []).filter(
          (state) => !(state.channelId === payload.channelId && state.user.id === payload.user.id),
        );

        return [...others, payload];
      },
    );
  };

  const onVoiceStateLeave = (payload: VoiceLeavePayload) => {
    queryClient.setQueryData<VoiceParticipant[]>(keys.voiceStates(payload.serverId), (states) =>
      (states ?? []).filter(
        (state) => !(state.channelId === payload.channelId && state.user.id === payload.userId),
      ),
    );
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
    void queryClient.invalidateQueries({ queryKey: keys.friends });
    void queryClient.invalidateQueries({ queryKey: keys.conversations });
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
  socket.on(SocketEvent.CONVERSATION_CREATE, onConversationCreate);
  socket.on(SocketEvent.VOICE_STATE, onVoiceState);
  socket.on(SocketEvent.VOICE_STATE_LEAVE, onVoiceStateLeave);
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
    socket.off(SocketEvent.CONVERSATION_CREATE, onConversationCreate);
    socket.off(SocketEvent.VOICE_STATE, onVoiceState);
    socket.off(SocketEvent.VOICE_STATE_LEAVE, onVoiceStateLeave);
    socket.off('connect', onConnect);
    socket.off('disconnect', onDisconnect);
  };
}
