/** Shapes the API returns and the web client consumes. Kept deliberately small. */

export type PresenceStatus = 'ONLINE' | 'IDLE' | 'DO_NOT_DISTURB' | 'OFFLINE';

export type ChannelType = 'TEXT' | 'VOICE' | 'CATEGORY';

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';

export interface PublicUser {
  id: string;
  username: string;
  avatarUrl: string | null;
  status: PresenceStatus;
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
