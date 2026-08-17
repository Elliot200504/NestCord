import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type { ServerBan } from '@nestcord/shared';

import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';
import { AuditLogService } from '../common/audit/audit-log.service';
import { outranksMember, type MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';
import type { CreateBanDto } from './dto/create-ban.dto';

const BAN_SELECT = {
  reason: true,
  bannedAt: true,
  user: { select: PUBLIC_USER_SELECT },
  issuer: { select: PUBLIC_USER_SELECT },
} as const;

/**
 * Bans. A ban is two things at once: the membership goes away, and a row stays
 * behind that `InvitesService.join` checks so the person cannot walk back in.
 */
@Injectable()
export class BansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly realtime: RealtimeService,
    private readonly audit: AuditLogService,
  ) {}

  /** Everyone barred from this server, most recent first. */
  async list(serverId: string): Promise<ServerBan[]> {
    const bans = await this.prisma.client.ban.findMany({
      where: { serverId },
      select: BAN_SELECT,
      orderBy: { bannedAt: 'desc' },
    });

    return bans.map(toServerBan);
  }

  /**
   * Ban someone, whether or not they are here right now — pre-emptively banning a
   * known troublemaker by id is the point of storing the ban separately from the
   * membership.
   *
   * Hierarchy is only checked when they *are* a member, because that is the only
   * time they have a rank to compare against.
   */
  async create(actor: MemberContext, targetUserId: string, dto: CreateBanDto): Promise<ServerBan> {
    if (targetUserId === actor.userId) {
      throw new BadRequestException('You cannot ban yourself');
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!user) throw new NotFoundException('No such user');

    const target = await this.permissions.findMemberContext(actor.serverId, targetUserId);

    if (target && !outranksMember(actor, target)) {
      throw new ForbiddenException('That member is the same rank as you or higher');
    }

    const existing = await this.prisma.client.ban.findUnique({
      where: { serverId_userId: { serverId: actor.serverId, userId: targetUserId } },
      select: { userId: true },
    });

    if (existing) throw new ConflictException('That user is already banned');

    const reason = dto.reason ?? null;

    // The ban row and the membership go together: a ban that left them in the
    // member list, or a removal with no ban row, would both be wrong.
    const ban = await this.prisma.client.$transaction(async (tx) => {
      const created = await tx.ban.create({
        data: {
          serverId: actor.serverId,
          userId: targetUserId,
          bannedBy: actor.userId,
          reason,
        },
        select: BAN_SELECT,
      });

      if (target) await tx.serverMember.delete({ where: { id: target.memberId } });

      return created;
    });

    if (target) {
      this.realtime.memberLeft({ serverId: actor.serverId, userId: targetUserId });
    }

    await this.audit.record({
      serverId: actor.serverId,
      actorId: actor.userId,
      action: 'MEMBER_BAN',
      targetId: targetUserId,
      reason,
    });

    return toServerBan(ban);
  }

  /**
   * Lift a ban. It does not put them back in the server — it only means they may
   * use an invite again.
   */
  async remove(actor: MemberContext, targetUserId: string): Promise<void> {
    const { count } = await this.prisma.client.ban.deleteMany({
      // Scoped by server so a ban elsewhere cannot be lifted from here.
      where: { serverId: actor.serverId, userId: targetUserId },
    });

    if (count === 0) throw new NotFoundException('That user is not banned');

    await this.audit.record({
      serverId: actor.serverId,
      actorId: actor.userId,
      action: 'MEMBER_UNBAN',
      targetId: targetUserId,
    });
  }
}

interface BanRow {
  reason: string | null;
  bannedAt: Date;
  user: Parameters<typeof toPublicUser>[0];
  issuer: Parameters<typeof toPublicUser>[0] | null;
}

function toServerBan(ban: BanRow): ServerBan {
  return {
    user: toPublicUser(ban.user),
    issuer: ban.issuer ? toPublicUser(ban.issuer) : null,
    reason: ban.reason,
    bannedAt: ban.bannedAt.toISOString(),
  };
}
