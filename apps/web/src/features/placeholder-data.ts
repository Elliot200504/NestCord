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

export interface PlaceholderMember {
  id: string;
  username: string;
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
  { id: 'general', name: 'general', type: 'TEXT', category: 'Text Channels' },
  { id: 'random', name: 'random', type: 'TEXT', category: 'Text Channels' },
  { id: 'dev', name: 'dev', type: 'TEXT', category: 'Text Channels' },
  { id: 'general-voice', name: 'General Voice', type: 'VOICE', category: 'Voice Channels' },
];

export const placeholderMembers: PlaceholderMember[] = [
  { id: '1', username: 'ada', status: 'ONLINE', role: 'Admin' },
  { id: '2', username: 'grace', status: 'ONLINE', role: 'Moderator' },
  { id: '3', username: 'linus', status: 'IDLE', role: 'Member' },
  { id: '4', username: 'margaret', status: 'DO_NOT_DISTURB', role: 'Member' },
  { id: '5', username: 'dennis', status: 'OFFLINE', role: 'Member' },
];

export const placeholderMessages: PlaceholderMessage[] = [
  { id: '1', author: 'ada', content: 'Morning everyone 👋', timestamp: '09:02' },
  {
    id: '2',
    author: 'grace',
    content: 'Has anyone looked at the new deploy?',
    timestamp: '09:04',
  },
  {
    id: '3',
    author: 'grace',
    content: 'The health check is green on my machine.',
    timestamp: '09:04',
  },
  {
    id: '4',
    author: 'linus',
    content: 'I pushed a fix for the login redirect.',
    timestamp: '09:11',
  },
];
