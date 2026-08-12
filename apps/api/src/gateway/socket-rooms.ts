import { Injectable } from '@nestjs/common';

import { has, Permission, rooms } from '@nestcord/shared';

import {
  OVERRIDE_CONTEXT_SELECT,
  resolveChannelPermissions,
} from '../common/permissions/channel-overrides';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';

/**
 * Which rooms a socket is allowed in.
 *
 * Room membership *is* the authorization boundary for realtime: a broadcast reaches
 * whoever is in the room, so a socket must never be joined to one before the server
 * has decided the user may read it. Everything here re-resolves permissions from the
 * database — the same resolution the HTTP guard uses, not a cheaper version of it.
 */
@Injectable()
export class SocketRooms {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Every room this user may currently read: their own room, each server they are a
   * member of, and each channel in those servers they can see.
   */
  async forUser(userId: string): Promise<string[]> {
    const memberships = await this.prisma.client.serverMember.findMany({
      where: { userId },
      select: { serverId: true },
    });

    const serverIds = memberships.map((membership) => membership.serverId);
    const channelIds = await this.visibleChannelIds(userId, serverIds);

    return [rooms.user(userId), ...serverIds.map(rooms.server), ...channelIds.map(rooms.channel)];
  }

  /** The channels the user can see across the given servers. */
  async visibleChannelIds(userId: string, serverIds: string[]): Promise<string[]> {
    const visible: string[] = [];

    for (const serverId of serverIds) {
      const member = await this.permissions.findMemberContext(serverId, userId);

      // Membership can disappear between the two queries; a non-member sees nothing.
      if (!member) continue;

      const channels = await this.prisma.client.channel.findMany({
        where: { serverId, type: { not: 'CATEGORY' } },
        select: { id: true, overrides: { select: OVERRIDE_CONTEXT_SELECT } },
      });

      for (const channel of channels) {
        const permissions = resolveChannelPermissions(member, channel.overrides);

        if (has(permissions, Permission.VIEW_CHANNEL)) visible.push(channel.id);
      }
    }

    return visible;
  }

  /** The servers a user belongs to, for aiming presence at the people who know them. */
  async serverIdsOf(userId: string): Promise<string[]> {
    const memberships = await this.prisma.client.serverMember.findMany({
      where: { userId },
      select: { serverId: true },
    });

    return memberships.map((membership) => membership.serverId);
  }
}
