import type { Message, PublicUser } from '@nestcord/shared';

/**
 * How close together two messages have to be to share a heading. Five minutes is
 * long enough to keep a burst of typing together and short enough that a reply hours
 * later gets its own timestamp.
 */
export const GROUP_WINDOW_MS = 5 * 60_000;

export interface MessageGroup {
  /** The first message's id — stable, so React keeps the DOM as the group grows. */
  id: string;
  author: PublicUser;
  /** Oldest first, as they are rendered. */
  messages: Message[];
}

/**
 * Consecutive messages from one author render under a single avatar and timestamp.
 *
 * A reply always starts a new group: it carries a quoted line above it, which would
 * read as belonging to the message before it if it were tucked into that group.
 */
export function groupMessages(messages: Message[]): MessageGroup[] {
  return messages.reduce<MessageGroup[]>((groups, message) => {
    const last = groups.at(-1);
    const previous = last?.messages.at(-1);

    const continues =
      last !== undefined &&
      previous !== undefined &&
      last.author.id === message.author.id &&
      message.replyTo === null &&
      withinWindow(previous.createdAt, message.createdAt);

    if (continues) {
      return [...groups.slice(0, -1), { ...last, messages: [...last.messages, message] }];
    }

    return [...groups, { id: message.id, author: message.author, messages: [message] }];
  }, []);
}

function withinWindow(earlier: string, later: string): boolean {
  return new Date(later).getTime() - new Date(earlier).getTime() <= GROUP_WINDOW_MS;
}

/** `09:02`, in the reader's own locale and timezone. */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** The full date, for the tooltip on a timestamp. */
export function formatFullTime(iso: string): string {
  return new Date(iso).toLocaleString();
}
