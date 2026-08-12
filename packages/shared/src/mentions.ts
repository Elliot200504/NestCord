/**
 * Mentions (PLAN.MD §8): `@username`, `@everyone` and `#channel`.
 *
 * Mentions are stored as the plain text they were typed as, not rewritten into id
 * form. That keeps the stored message exactly what the author wrote and means the
 * web client can resolve names against the member and channel lists it already has.
 * The trade-off is that a rename does not update old mentions, which for a few
 * hundred users is an acceptable price for not needing a rewrite step on every read.
 */

/** Matches `@name`, where the name follows the same rules as a username. */
const USER_MENTION = /@([a-zA-Z0-9._]+)/g;

/** Matches `#name`, where the name follows the channel slug rules. */
const CHANNEL_MENTION = /#([a-z0-9-]+)/g;

export const EVERYONE_MENTION = 'everyone';

/** A single mention found in message content, with where it sits in the string. */
export interface Mention {
  type: 'user' | 'everyone' | 'channel';
  /** The username or channel name, without the leading sigil. Empty for `@everyone`. */
  name: string;
  /** Index of the sigil in the content. */
  start: number;
  /** Index one past the end of the mention. */
  end: number;
}

/**
 * Every mention in `content`, in the order they appear.
 *
 * Case is preserved as typed; callers matching against usernames or channel names
 * should compare case-insensitively, which is what `mentionMatches` does.
 */
export function parseMentions(content: string): Mention[] {
  const mentions: Mention[] = [];

  for (const match of content.matchAll(USER_MENTION)) {
    const name = match[1] ?? '';

    mentions.push({
      type: name.toLowerCase() === EVERYONE_MENTION ? 'everyone' : 'user',
      name: name.toLowerCase() === EVERYONE_MENTION ? '' : name,
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  for (const match of content.matchAll(CHANNEL_MENTION)) {
    mentions.push({
      type: 'channel',
      name: match[1] ?? '',
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return mentions.sort((a, b) => a.start - b.start);
}

/** The usernames mentioned in `content`, lowercased and deduplicated. */
export function mentionedUsernames(content: string): string[] {
  const names = parseMentions(content)
    .filter((mention) => mention.type === 'user')
    .map((mention) => mention.name.toLowerCase());

  return [...new Set(names)];
}

/** Does `content` mention the whole channel? */
export function mentionsEveryone(content: string): boolean {
  return parseMentions(content).some((mention) => mention.type === 'everyone');
}

/** Names are compared case-insensitively, so `@Alice` reaches `alice`. */
export function mentionMatches(mention: Mention, name: string): boolean {
  return mention.name.toLowerCase() === name.toLowerCase();
}
