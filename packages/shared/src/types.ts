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

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 50;
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

export const SERVER_NAME_MIN_LENGTH = 2;
export const SERVER_NAME_MAX_LENGTH = 100;
/** A per-server nickname, same budget as a display name. */
export const NICKNAME_MAX_LENGTH = 32;
export const ROLE_NAME_MAX_LENGTH = 32;
/** The default role every server gets. Named after Discord's, and undeletable. */
export const DEFAULT_ROLE_NAME = '@everyone';
/** The text channel created alongside a new server, so it is never empty. */
export const DEFAULT_CHANNEL_NAME = 'general';

/**
 * Invite codes. Eight characters from an unambiguous alphabet — no O/0 or I/l/1 —
 * because these get read aloud and retyped.
 */
export const INVITE_CODE_LENGTH = 8;
/** No I, L or O in either case, and no 0 or 1. */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
export const INVITE_CODE_PATTERN = /^[A-HJKMNP-Za-hjkmnp-z2-9]{8}$/;
