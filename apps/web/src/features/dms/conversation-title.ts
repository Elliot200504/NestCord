import type { Conversation, PublicUser } from '@nestcord/shared';

/**
 * What to call a conversation, from one person's point of view.
 *
 * A one-to-one DM has no stored name — it is titled after the other person, and who
 * "the other person" is depends on who is looking. A group uses its name if it has
 * one, and otherwise reads out the people in it.
 */
export function conversationTitle(conversation: Conversation, viewerId: string): string {
  if (conversation.name) return conversation.name;

  const others = otherParticipants(conversation, viewerId);

  if (others.length === 0) return 'Just you';

  return others.map(displayName).join(', ');
}

/** Everyone but you, in the order the server listed them. */
export function otherParticipants(conversation: Conversation, viewerId: string): PublicUser[] {
  return conversation.participants.filter((participant) => participant.id !== viewerId);
}

/**
 * The one face to show for a conversation in a list.
 *
 * A group has no single face, so it gets none and the list falls back to an icon —
 * showing one member's avatar for a group would say the wrong thing about who is in it.
 */
export function conversationAvatar(
  conversation: Conversation,
  viewerId: string,
): PublicUser | null {
  if (conversation.isGroup) return null;

  return otherParticipants(conversation, viewerId)[0] ?? null;
}

export function displayName(user: PublicUser): string {
  return user.displayName ?? user.username;
}
