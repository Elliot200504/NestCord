import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';

import { has, resolvePermissions, type PermissionFlag } from '@nestcord/shared';

import { PrismaService } from '../prisma/prisma.service';
import { OVERRIDE_CONTEXT_SELECT, resolveChannelPermissions } from './channel-overrides';
import { MemberContext, NO_ROLE_POSITION, OWNER_POSITION } from './member-context';

/** Everything a `MemberContext` is built from, in one round trip. */
const MEMBER_CONTEXT_SELECT = {
  id: true,
  userId: true,
  serverId: true,
  server: { select: { ownerId: true } },
  roles: { select: { role: { select: { id: true, permissions: true, position: true } } } },
} as const;

/**
 * The single place server permissions are resolved from the database (PLAN.MD §5).
 *
 * The bitfield maths lives in `@nestcord/shared` so the web client can render with
 * the same rules; this class is the half that needs Prisma. The guard, the services
 * and later the gateway all come through here — two copies of this would drift, and
 * the drift would be a security hole.
 */
@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Null when the user is not a member, or the server does not exist. */
  async findMemberContext(serverId: string, userId: string): Promise<MemberContext | null> {
    const member = await this.prisma.client.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      select: MEMBER_CONTEXT_SELECT,
    });

    if (!member) return null;

    const isOwner = member.server.ownerId === userId;
    const roles = member.roles.map((entry) => entry.role);

    return {
      serverId: member.serverId,
      memberId: member.id,
      userId: member.userId,
      isOwner,
      permissions: resolvePermissions({ isOwner, roleBits: roles.map((role) => role.permissions) }),
      roleIds: roles.map((role) => role.id),
      highestPosition: isOwner
        ? OWNER_POSITION
        : roles.reduce((highest, role) => Math.max(highest, role.position), NO_ROLE_POSITION),
    };
  }

  /**
   * 404 rather than 403 for a non-member: someone who is not in a server should
   * not be able to tell an existing server from one that never existed.
   */
  async requireMembership(serverId: string, userId: string): Promise<MemberContext> {
    const member = await this.findMemberContext(serverId, userId);

    if (!member) throw new NotFoundException('No such server');

    return member;
  }

  /** Membership is not authorization — the flag is checked on top of it. */
  async requirePermission(
    serverId: string,
    userId: string,
    flag: PermissionFlag,
  ): Promise<MemberContext> {
    const member = await this.requireMembership(serverId, userId);

    if (!has(member.permissions, flag)) {
      throw new ForbiddenException('You do not have permission to do that in this server');
    }

    return member;
  }

  /**
   * The member's permissions inside one channel, overrides applied.
   *
   * 404 for a channel in another server: a channel id from elsewhere should look
   * missing rather than forbidden.
   */
  async resolveChannelPermissions(member: MemberContext, channelId: string): Promise<number> {
    const channel = await this.prisma.client.channel.findFirst({
      where: { id: channelId, serverId: member.serverId },
      select: { overrides: { select: OVERRIDE_CONTEXT_SELECT } },
    });

    if (!channel) throw new NotFoundException('No such channel');

    return resolveChannelPermissions(member, channel.overrides);
  }

  /**
   * The channel equivalent of `requirePermission`. A channel override can take a
   * permission away that the server grants, so anything acting on a single channel
   * has to come through here rather than reading `member.permissions`.
   */
  async requireChannelPermission(
    member: MemberContext,
    channelId: string,
    flag: PermissionFlag,
  ): Promise<number> {
    const permissions = await this.resolveChannelPermissions(member, channelId);

    // Losing VIEW_CHANNEL clears every other bit, so a hidden channel fails this
    // check whatever the flag was.
    if (!has(permissions, flag)) {
      throw new ForbiddenException('You do not have permission to do that in this channel');
    }

    return permissions;
  }

  /** The owner's own row, used where only the owner may act. */
  async requireOwner(serverId: string, userId: string): Promise<MemberContext> {
    const member = await this.requireMembership(serverId, userId);

    if (!member.isOwner) {
      throw new ForbiddenException('Only the server owner may do that');
    }

    return member;
  }
}
