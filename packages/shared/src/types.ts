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

/** Avatars: what the API accepts and what the browser should offer in its file picker. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
