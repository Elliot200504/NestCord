import { randomInt } from 'node:crypto';

import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';

import {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  type Invite,
  type InvitePreview,
  type Server,
  type ServerSummary,
} from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';
import type { CreateInviteDto } from './dto/create-invite.dto';
import { MembersService } from './members.service';
import { ServersService } from './servers.service';

const INVITE_SELECT = {
  code: true,
  serverId: true,
  uses: true,
  maxUses: true,
  expiresAt: true,
  createdAt: true,
} as const;

/** How many times to retry a code collision before giving up. */
const CODE_ATTEMPTS = 5;

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly servers: ServersService,
    private readonly members: MembersService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Invites that could still be used, newest first. */
  async list(serverId: string): Promise<Invite[]> {
    const invites = await this.prisma.client.invite.findMany({
      where: { serverId },
      select: INVITE_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return invites.map(toInvite);
  }

  async create(member: MemberContext, dto: CreateInviteDto): Promise<Invite> {
    const expiresAt =
      dto.expiresInHours === undefined
        ? null
        : new Date(Date.now() + dto.expiresInHours * 60 * 60 * 1000);

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
      const code = generateCode();

      const taken = await this.prisma.client.invite.findUnique({
        where: { code },
        select: { code: true },
      });

      if (taken) continue;

      const invite = await this.prisma.client.invite.create({
        data: {
          code,
          serverId: member.serverId,
          expiresAt,
          maxUses: dto.maxUses ?? null,
        },
        select: INVITE_SELECT,
      });

      return toInvite(invite);
    }

    // 54^8 codes: colliding five times running means something is wrong on our
    // side, and silently returning a duplicate would be worse than failing.
    throw new InternalServerErrorException('Could not generate an invite code');
  }

  async revoke(member: MemberContext, code: string): Promise<void> {
    const { count } = await this.prisma.client.invite.deleteMany({
      // Scoped by server: knowing a code must not be enough to delete it from
      // somebody else's server.
      where: { code, serverId: member.serverId },
    });

    if (count === 0) throw new NotFoundException('No such invite');
  }

  /** What a signed-in user sees before deciding to join. */
  async preview(code: string): Promise<InvitePreview> {
    const invite = await this.findUsable(code);

    return {
      code: invite.code,
      server: invite.server,
      memberCount: invite.memberCount,
    };
  }

  /**
   * Joining is idempotent: someone who follows the same link twice lands in the
   * server rather than seeing an error, and the second visit does not burn a use.
   *
   * Membership is checked before usability on purpose. A one-use invite is spent the
   * moment it is used, so re-checking usability first would turn "you are already
   * here" into "that invite is invalid" for the very person who just used it.
   */
  async join(userId: string, code: string): Promise<Server> {
    const invite = await this.findInvite(code);
    const serverId = invite.server.id;

    const existing = await this.permissions.findMemberContext(serverId, userId);
    if (existing) return this.servers.findOne(serverId, existing.permissions);

    assertUsable(invite);

    const banned = await this.prisma.client.ban.findUnique({
      where: { serverId_userId: { serverId, userId } },
      select: { serverId: true },
    });

    if (banned) throw new ForbiddenException('You cannot join that server');

    const everyone = await this.prisma.client.role.findFirst({
      where: { serverId, isDefault: true },
      select: { id: true },
    });

    if (!everyone) {
      throw new NotFoundException('That server is not set up correctly');
    }

    await this.prisma.client.$transaction(async (tx) => {
      const member = await tx.serverMember.create({ data: { serverId, userId } });
      await tx.memberRole.create({ data: { memberId: member.id, roleId: everyone.id } });
      // Counted inside the transaction so a failed join does not spend a use. Two
      // simultaneous joins on a last-use invite could both land; at a few hundred
      // users that is not worth locking the row for.
      await tx.invite.update({ where: { code }, data: { uses: { increment: 1 } } });
    });

    const member = await this.permissions.requireMembership(serverId, userId);

    // The member list is live for everyone already in the server.
    const joined = await this.members.findOne(serverId, userId);

    if (joined) this.realtime.memberJoined({ serverId, member: joined });

    return this.servers.findOne(serverId, member.permissions);
  }

  /** The invite and the server it points at, said nothing yet about usability. */
  private async findInvite(code: string): Promise<FoundInvite> {
    const invite = await this.prisma.client.invite.findUnique({
      where: { code },
      select: {
        code: true,
        uses: true,
        maxUses: true,
        expiresAt: true,
        server: {
          select: {
            id: true,
            name: true,
            iconUrl: true,
            ownerId: true,
            _count: { select: { members: true } },
          },
        },
      },
    });

    if (!invite) throw invalidInvite();

    return {
      code: invite.code,
      uses: invite.uses,
      maxUses: invite.maxUses,
      expiresAt: invite.expiresAt,
      server: {
        id: invite.server.id,
        name: invite.server.name,
        iconUrl: invite.server.iconUrl,
        ownerId: invite.server.ownerId,
      },
      memberCount: invite.server._count.members,
    };
  }

  /**
   * One message for every unusable invite — expired, used up or never existed. A
   * stranger holding a guessed code learns nothing about which it was.
   */
  private async findUsable(code: string): Promise<FoundInvite> {
    const invite = await this.findInvite(code);

    assertUsable(invite);

    return invite;
  }
}

/** An invite row plus the server summary the join and preview paths both need. */
interface FoundInvite {
  code: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  server: ServerSummary;
  memberCount: number;
}

function invalidInvite(): NotFoundException {
  return new NotFoundException('That invite is invalid or has expired');
}

function assertUsable(invite: FoundInvite): void {
  if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) throw invalidInvite();
  if (invite.maxUses !== null && invite.uses >= invite.maxUses) throw invalidInvite();
}

function generateCode(): string {
  // charAt rather than indexing: it returns a string, so the code stays typed
  // without a non-null assertion.
  return Array.from({ length: INVITE_CODE_LENGTH }, () =>
    INVITE_CODE_ALPHABET.charAt(randomInt(INVITE_CODE_ALPHABET.length)),
  ).join('');
}

interface InviteRow {
  code: string;
  serverId: string;
  uses: number;
  maxUses: number | null;
  expiresAt: Date | null;
  createdAt: Date;
}

function toInvite(invite: InviteRow): Invite {
  return {
    code: invite.code,
    serverId: invite.serverId,
    uses: invite.uses,
    maxUses: invite.maxUses,
    expiresAt: invite.expiresAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
  };
}
