import type { Channel, ChannelOverride } from '@nestcord/shared';

import { OVERRIDE_CONTEXT_SELECT } from '../common/permissions/channel-overrides';

/** The columns a `Channel` is built from, plus the overrides it resolves against. */
export const CHANNEL_SELECT = {
  id: true,
  serverId: true,
  name: true,
  type: true,
  topic: true,
  position: true,
  parentId: true,
  overrides: { select: OVERRIDE_CONTEXT_SELECT },
} as const;

export type ChannelRow = {
  id: string;
  serverId: string;
  name: string;
  type: 'TEXT' | 'VOICE' | 'CATEGORY';
  topic: string | null;
  position: number;
  parentId: string | null;
};

/**
 * The one place a channel row becomes a response body. `permissions` is passed in
 * rather than derived here, so what the client is told it may do is exactly what the
 * service resolved.
 */
export function toChannel(channel: ChannelRow, permissions: number): Channel {
  return {
    id: channel.id,
    serverId: channel.serverId,
    name: channel.name,
    type: channel.type,
    topic: channel.topic,
    position: channel.position,
    parentId: channel.parentId,
    permissions,
  };
}

export const CHANNEL_OVERRIDE_SELECT = {
  type: true,
  roleId: true,
  userId: true,
  allow: true,
  deny: true,
} as const;

export function toChannelOverride(override: ChannelOverride): ChannelOverride {
  return {
    type: override.type,
    roleId: override.roleId,
    userId: override.userId,
    allow: override.allow,
    deny: override.deny,
  };
}
