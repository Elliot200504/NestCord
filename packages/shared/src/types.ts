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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

export const MESSAGE_MAX_LENGTH = 2000;
export const MESSAGE_PAGE_SIZE = 50;
export const USERNAME_MIN_LENGTH = 2;
export const USERNAME_MAX_LENGTH = 32;
export const PASSWORD_MIN_LENGTH = 8;
