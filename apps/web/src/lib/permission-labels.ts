import type { PermissionName } from '@nestcord/shared';

/** Readable labels for the flags. The bitfield names are for code, not for people. */
export const PERMISSION_LABELS: Record<PermissionName, string> = {
  VIEW_CHANNEL: 'View channels',
  SEND_MESSAGES: 'Send messages',
  MANAGE_MESSAGES: 'Manage messages',
  ATTACH_FILES: 'Attach files',
  ADD_REACTIONS: 'Add reactions',
  CONNECT: 'Join voice',
  SPEAK: 'Speak in voice',
  MANAGE_CHANNELS: 'Manage channels',
  MANAGE_SERVER: 'Manage server',
  MANAGE_ROLES: 'Manage roles',
  KICK_MEMBERS: 'Kick members',
  BAN_MEMBERS: 'Ban members',
  ADMINISTRATOR: 'Administrator',
};

/**
 * The flags a channel override can touch. Server-wide powers are deliberately left
 * out: denying MANAGE_SERVER in one channel would mean nothing.
 */
export const CHANNEL_PERMISSION_NAMES = [
  'VIEW_CHANNEL',
  'SEND_MESSAGES',
  'MANAGE_MESSAGES',
  'ATTACH_FILES',
  'ADD_REACTIONS',
  'CONNECT',
  'SPEAK',
  'MANAGE_CHANNELS',
  'MANAGE_ROLES',
] as const satisfies readonly PermissionName[];
