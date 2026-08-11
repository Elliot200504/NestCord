/**
 * Scaffolding for the layout shell.
 *
 * The API endpoints for servers, channels and messages arrive in later phases
 * (PLAN.MD §34). Until then the shell renders from this static data so the
 * layout can be built and reviewed. Delete this file once the real queries land.
 */
import type { PresenceStatus } from '@nestcord/shared';

export interface PlaceholderServer {
  id: string;
  name: string;
  initials: string;
}

export interface PlaceholderChannel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
  category: string;
}

/** Shaped like `PublicUser` so it can be handed straight to `UserAvatar`. */
export interface PlaceholderMember {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  accentColor: string | null;
  status: PresenceStatus;
  role: string;
}

export interface PlaceholderMessage {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export const placeholderServers: PlaceholderServer[] = [
  { id: 'hq', name: 'NestCord HQ', initials: 'NH' },
  { id: 'book-club', name: 'Book Club', initials: 'BC' },
  { id: 'game-night', name: 'Game Night', initials: 'GN' },
];

export const placeholderChannels: PlaceholderChannel[] = [
  { id: 'general', name: 'general', type: 'TEXT', category: 'Conversations' },
  { id: 'random', name: 'random', type: 'TEXT', category: 'Conversations' },
  { id: 'dev', name: 'dev', type: 'TEXT', category: 'Conversations' },
  { id: 'general-voice', name: 'Around the table', type: 'VOICE', category: 'Voice' },
];

export const placeholderMembers: PlaceholderMember[] = [
  { id: '1', username: 'ada', displayName: 'Ada', accentColor: '#e0234e', status: 'ONLINE', role: 'Admin', avatarUrl: null },
  { id: '2', username: 'grace', displayName: 'Grace H.', accentColor: null, status: 'ONLINE', role: 'Moderator', avatarUrl: null },
  { id: '3', username: 'linus', displayName: null, accentColor: '#f0b232', status: 'IDLE', role: 'Member', avatarUrl: null },
  { id: '4', username: 'margaret', displayName: 'Margaret', accentColor: null, status: 'DO_NOT_DISTURB', role: 'Member', avatarUrl: null },
  { id: '5', username: 'dennis', displayName: null, accentColor: null, status: 'OFFLINE', role: 'Member', avatarUrl: null },
];

export const placeholderMessages: PlaceholderMessage[] = [
  { id: '1', author: 'ada', content: 'morning, kettle is on ☕', timestamp: '09:02' },
  {
    id: '2',
    author: 'grace',
    content: 'did anyone actually look at the deploy last night',
    timestamp: '09:04',
  },
  {
    id: '3',
    author: 'grace',
    content: 'health check is green on my machine at least',
    timestamp: '09:04',
  },
  {
    id: '4',
    author: 'linus',
    content: 'pushed a fix for the login redirect before bed, should be fine now',
    timestamp: '09:11',
  },
];
