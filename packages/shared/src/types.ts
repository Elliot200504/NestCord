/** Shapes the API returns and the web client consumes. Kept deliberately small. */

export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';

export type ChannelType = 'TEXT' | 'VOICE' | 'CATEGORY';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

/** The user shape safe to hand to anyone: no email, no hash, no session detail. */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  status: PresenceStatus;
}

/** A public user plus the parts only a profile card needs. */
export interface UserProfile extends PublicUser {
  bio: string | null;
  /** ISO string — JSON has no date type. */
  createdAt: string;
}

/** Your own profile. The email is yours alone, so it never appears on PublicUser. */
export interface CurrentUser extends UserProfile {
  email: string;
}

/** One signed-in device, as shown in settings. The token itself is never exposed. */
export interface UserSession {
  id: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  /** True for the session making the request — the one you must not lock yourself out of. */
  current: boolean;
}

/**
 * What the auth endpoints return. The refresh token is deliberately absent — it
 * travels in an httpOnly cookie the browser never exposes to JavaScript.
 */
export interface AuthSession {
  accessToken: string;
  user: PublicUser;
}

/** A role's permissions are a bitfield — see `permissions.ts` for the flags. */
export interface ServerRole {
  id: string;
  name: string;
  color: string | null;
  permissions: number;
  /** Higher wins. Hierarchy decides who may manage whom. */
  position: number;
  /** True for the `@everyone` role, which cannot be deleted. */
  isDefault: boolean;
}

/**
 * One channel or category in a server.
 *
 * Categories are channels with `type: 'CATEGORY'`; the channels inside one point at
 * it with `parentId`. That is one table and one sidebar loop instead of two.
 */
export interface Channel {
  id: string;
  serverId: string;
  name: string;
  type: ChannelType;
  topic: string | null;
  /** Lower first, within the same parent. */
  position: number;
  /** The category this sits in, or null for a top-level channel. */
  parentId: string | null;
  /**
   * The requesting member's permissions *in this channel*, overrides applied and
   * resolved on the server. For rendering only — every route re-resolves it.
   */
  permissions: number;
}

/**
 * A channel-level permission override for one role or one member.
 *
 * `allow` and `deny` are bitfields; a flag in neither is inherited from the server.
 */
export interface ChannelOverride {
  type: 'ROLE' | 'MEMBER';
  /** Set when `type` is `ROLE`. */
  roleId: string | null;
  /** Set when `type` is `MEMBER`. */
  userId: string | null;
  allow: number;
  deny: number;
}

/** One uploaded file hanging off a message. The bytes live on disk (PLAN.MD §9). */
export interface MessageAttachment {
  id: string;
  /** The uploader's original filename, kept for display only — never used as a path. */
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * One emoji's reactions on a message, already grouped.
 *
 * The client needs a count and whether it should render its own button as pressed;
 * it never needs the full list of reactors, so the API does not send one.
 */
export interface MessageReaction {
  emoji: string;
  count: number;
  /** True when the requesting user is one of the reactors. */
  me: boolean;
}

/**
 * The message a reply points at, as the single quoted line above the reply.
 *
 * Null when the message is not a reply *or* when the message it replied to has been
 * deleted — the reply survives its target, and both cases render the same way.
 */
export interface MessageReference {
  id: string;
  author: PublicUser;
  content: string;
}

/** A message in a channel, with everything needed to render it in one object. */
export interface Message {
  id: string;
  channelId: string;
  author: PublicUser;
  /** Raw text as it was typed: markdown and mentions are resolved at render time. */
  content: string;
  createdAt: string;
  /** Set once the author has edited it, so the UI can mark it. */
  editedAt: string | null;
  replyTo: MessageReference | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  /**
   * The provisional id the sender gave this message before it was stored, echoed
   * back on the copy that answers their send and on its broadcast.
   *
   * It exists so the sender can recognise its own message coming back: the optimistic
   * copy is already on screen under this id, so the broadcast replaces it in place
   * instead of arriving as a second message and being collapsed a moment later.
   *
   * Absent on history, on edits, and on anything the reader did not send. The
   * broadcast carries it to the whole channel, where it simply matches nothing.
   */
  nonce?: string;
}

/** A server as the rail shows it: enough to draw an icon and a tooltip. */
export interface ServerSummary {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
}

/** One server in full, as the app shell needs it when you open the server. */
export interface Server extends ServerSummary {
  createdAt: string;
  memberCount: number;
  roles: ServerRole[];
  /**
   * The requesting member's own server-level permissions, resolved on the server.
   * The client uses this to decide what to render and nothing else — every route
   * re-resolves it from the database.
   */
  permissions: number;
}

export interface ServerMember {
  user: PublicUser;
  nickname: string | null;
  joinedAt: string;
  roleIds: string[];
}

export interface Invite {
  code: string;
  serverId: string;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

/** What someone holding a code sees before they commit to joining. */
export interface InvitePreview {
  code: string;
  server: ServerSummary;
  memberCount: number;
}

/**
 * Which way round a friendship is, from the asking user's point of view.
 *
 * One row covers both people, so the row alone cannot say whether you sent the
 * request or received it — this is that answer, resolved per viewer.
 */
export type FriendDirection = 'INCOMING' | 'OUTGOING';

/**
 * One entry on the friends page: the other person, plus where you stand.
 *
 * Always relative to whoever asked. The same stored row is an incoming request to
 * one person and an outgoing one to the other, so the API resolves that rather than
 * making the client work out which side of the pair it is looking at.
 */
export interface Friend {
  /** The friendship row. Actions address the *user*, so this is for keys and links. */
  id: string;
  user: PublicUser;
  status: FriendshipStatus;
  /**
   * Meaningful for `PENDING` (who asked) and `BLOCKED` (who blocked). On `ACCEPTED`
   * it is history: it says who originally asked, which nothing renders.
   */
  direction: FriendDirection;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 50;
/** One screenful is 50; asking for more than this at once is refused. */
export const MESSAGE_MAX_PAGE_SIZE = 100;
export const MESSAGE_MAX_ATTACHMENTS = 10;
/**
 * An emoji is a handful of code points once skin tones and ZWJ sequences are in
 * play, so this is generous — it is a sanity cap, not a validation rule.
 */
export const REACTION_EMOJI_MAX_LENGTH = 32;
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 32;
/** Letters, digits, underscore and dot — no spaces, so mentions stay unambiguous. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9._]+$/;
export const PASSWORD_MIN_LENGTH = 8;
/** Argon2 handles long inputs fine; the cap exists so a huge body cannot burn CPU. */
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 32;
/** Two short lines under a name — long enough to say something, short enough to read. */
export const BIO_MAX_LENGTH = 190;
/** Six-digit hex, the form a colour input produces. */
export const ACCENT_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Image uploads: what the API accepts and what a file picker should offer. */
export const IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const SERVER_ICON_MAX_BYTES = 2 * 1024 * 1024;

/**
 * Message attachments: images plus PDF (PLAN.MD §9).
 *
 * Every type here is one the API can recognise from the file's own leading bytes,
 * because the uploader's declared MIME type is only a claim. Widening the list means
 * adding a signature to `apps/api/src/common/storage/`, not just a string here.
 */
export const ATTACHMENT_MIME_TYPES = [...IMAGE_MIME_TYPES, 'application/pdf'] as const;
export const ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;

export const SERVER_NAME_MIN_LENGTH = 2;
export const SERVER_NAME_MAX_LENGTH = 100;
/** A per-server nickname, same budget as a display name. */
export const NICKNAME_MAX_LENGTH = 32;
export const ROLE_NAME_MAX_LENGTH = 32;
/** The default role every server gets. Named after Discord's, and undeletable. */
export const DEFAULT_ROLE_NAME = '@everyone';
/** The text channel created alongside a new server, so it is never empty. */
export const DEFAULT_CHANNEL_NAME = 'general';

export const CHANNEL_NAME_MAX_LENGTH = 32;
/** Two lines in the channel header — a sentence about the channel, not an essay. */
export const CHANNEL_TOPIC_MAX_LENGTH = 512;

/**
 * Invite codes. Eight characters from an unambiguous alphabet — no O/0 or I/l/1 —
 * because these get read aloud and retyped.
 */
export const INVITE_CODE_LENGTH = 8;
/** No I, L or O in either case, and no 0 or 1. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export const INVITE_CODE_PATTERN = /^[A-HJKMNP-Za-hjkmnp-z2-9]{8}$/;
