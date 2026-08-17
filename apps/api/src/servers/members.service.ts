import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { has, Permission, type ServerMember } from '@nestcord/shared';

import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';
import { AuditLogService } from '../common/audit/audit-log.service';
import { outranksMember, type MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';
import type { UpdateMemberDto } from './dto/update-member.dto';

const MEMBER_SELECT = {
  nickname: true,
  joinedAt: true,
  user: { select: PUBLIC_USER_SELECT },
  roles: { select: { roleId: true } },
} as const;

@Injectable()
export class MembersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditLogService,
  ) {}

  /**
   * The member list. Small servers only (PLAN.MD §1), so this is not paginated —
   * a few hundred rows is one cheap query.
   */
  async list(serverId: string): Promise<ServerMember[]> {
    const members = await this.prisma.client.serverMember.findMany({
      where: { serverId },
      select: MEMBER_SELECT,
      orderBy: { joinedAt: 'asc' },
    });

    return members.map(toServerMember);
  }

  /** One member, in the same shape the list returns. Null when they are not one. */
  async findOne(serverId: string, userId: string): Promise<ServerMember | null> {
    const member = await this.prisma.client.serverMember.findUnique({
      where: { serverId_userId: { serverId, userId } },
      select: MEMBER_SELECT,
    });

    return member ? toServerMember(member) : null;
  }

  /**
   * Nicknames: your own needs nothing, anyone else's needs MANAGE_SERVER and the
   * hierarchy to be on your side.
   */
  async update(
    actor: MemberContext,
    targetUserId: string,
    dto: UpdateMemberDto,
  ): Promise<ServerMember> {
    const target = await this.permissions.findMemberContext(actor.serverId, targetUserId);

    if (!target) throw new NotFoundException('That user is not a member of this server');

    if (target.userId !== actor.userId) {
      if (!has(actor.permissions, Permission.MANAGE_SERVER)) {
        throw new ForbiddenException('You cannot change other members’ nicknames');
      }

      if (!outranksMember(actor, target)) {
        throw new ForbiddenException('That member is the same rank as you or higher');
      }
    }

    const member = await this.prisma.client.serverMember.update({
      where: { id: target.memberId },
      data: { ...(dto.nickname === undefined ? {} : { nickname: dto.nickname }) },
      select: MEMBER_SELECT,
    });

    return toServerMember(member);
  }

  /**
   * Kicking removes the membership but not the person's right to come back — they
   * can use a fresh invite. Barring them for good is what `BansService` is for.
   */
  async kick(actor: MemberContext, targetUserId: string, reason?: string): Promise<void> {
    const target = await this.permissions.findMemberContext(actor.serverId, targetUserId);

    if (!target) throw new NotFoundException('That user is not a member of this server');

    if (target.userId === actor.userId) {
      throw new BadRequestException('Use leave rather than kicking yourself');
    }

    if (!outranksMember(actor, target)) {
      throw new ForbiddenException('That member is the same rank as you or higher');
    }

    await this.prisma.client.serverMember.delete({ where: { id: target.memberId } });

    this.realtime.memberLeft({ serverId: actor.serverId, userId: targetUserId });

    await this.audit.record({
      serverId: actor.serverId,
      actorId: actor.userId,
      action: 'MEMBER_KICK',
      targetId: targetUserId,
      reason: reason ?? null,
    });
  }
}

interface MemberRow {
  nickname: string | null;
  joinedAt: Date;
  user: Parameters<typeof toPublicUser>[0];
  roles: { roleId: string }[];
}

function toServerMember(member: MemberRow): ServerMember {
  return {
    user: toPublicUser(member.user),
    nickname: member.nickname,
    joinedAt: member.joinedAt.toISOString(),
    roleIds: member.roles.map((entry) => entry.roleId),
  };
}
