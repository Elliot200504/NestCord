import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  ALL_PERMISSIONS,
  DEFAULT_CHANNEL_NAME,
  DEFAULT_EVERYONE_PERMISSIONS,
  DEFAULT_ROLE_NAME,
  type Server,
  type ServerSummary,
} from '@nestcord/shared';

import type { MemberContext } from '../common/permissions/member-context';
import { PrismaService } from '../common/prisma/prisma.service';
import { RealtimeService } from '../gateway/realtime.service';
import { ROLE_SELECT, toServerRole } from '../roles/role-response';
import type { UpdateServerDto } from './dto/update-server.dto';
import { ServerIconStorage } from './server-icon.storage';

const SUMMARY_SELECT = { id: true, name: true, iconUrl: true, ownerId: true } as const;

const SERVER_SELECT = {
  ...SUMMARY_SELECT,
  createdAt: true,
  roles: { select: ROLE_SELECT, orderBy: { position: 'desc' } },
  _count: { select: { members: true } },
} as const;

@Injectable()
export class ServersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly icons: ServerIconStorage,
    private readonly realtime: RealtimeService,
  ) {}

  /**
   * A new server needs four things to be usable, so they go in one transaction: the
   * server, an `@everyone` role, the owner's membership, and a first text channel so
   * the server is never an empty shell.
   */
  async create(userId: string, name: string): Promise<Server> {
    const serverId = await this.prisma.client.$transaction(async (tx) => {
      const server = await tx.server.create({ data: { name, ownerId: userId } });

      const everyone = await tx.role.create({
        data: {
          serverId: server.id,
          name: DEFAULT_ROLE_NAME,
          permissions: DEFAULT_EVERYONE_PERMISSIONS,
          position: 0,
          isDefault: true,
        },
      });

      const member = await tx.serverMember.create({ data: { serverId: server.id, userId } });
      await tx.memberRole.create({ data: { memberId: member.id, roleId: everyone.id } });

      await tx.channel.create({
        data: { serverId: server.id, name: DEFAULT_CHANNEL_NAME, type: 'TEXT', position: 0 },
      });

      return server.id;
    });

    // Rooms are resolved when a socket connects, so the creator's existing sockets
    // know nothing about a server made a moment later. Without this the first channel
    // of a brand new server would not deliver a message until a reload.
    this.realtime.admitToServer(serverId, userId);

    // The creator is the owner, so their permissions need no resolving.
    return this.findOne(serverId, ALL_PERMISSIONS);
  }

  /** The rail: every server the user is a member of. */
  async listMine(userId: string): Promise<ServerSummary[]> {
    const servers = await this.prisma.client.server.findMany({
      where: { members: { some: { userId } } },
      select: SUMMARY_SELECT,
      orderBy: { createdAt: 'asc' },
    });

    return servers.map(toServerSummary);
  }

  /**
   * Takes the resolved permissions rather than re-deriving them, so what the client
   * is told it may do is exactly what the guard decided.
   */
  async findOne(serverId: string, permissions: number): Promise<Server> {
    const server = await this.prisma.client.server.findUnique({
      where: { id: serverId },
      select: SERVER_SELECT,
    });

    if (!server) throw new NotFoundException('No such server');

    return {
      ...toServerSummary(server),
      createdAt: server.createdAt.toISOString(),
      memberCount: server._count.members,
      roles: server.roles.map(toServerRole),
      permissions,
    };
  }

  async update(member: MemberContext, dto: UpdateServerDto): Promise<Server> {
    await this.prisma.client.server.update({
      where: { id: member.serverId },
      data: { ...(dto.name === undefined ? {} : { name: dto.name }) },
    });

    return this.findOne(member.serverId, member.permissions);
  }

  async setIcon(member: MemberContext, file: Express.Multer.File): Promise<Server> {
    const previous = await this.prisma.client.server.findUnique({
      where: { id: member.serverId },
      select: { iconUrl: true },
    });

    const iconUrl = await this.icons.save(file);

    await this.prisma.client.server.update({
      where: { id: member.serverId },
      data: { iconUrl },
    });

    await this.icons.remove(previous?.iconUrl ?? null);

    return this.findOne(member.serverId, member.permissions);
  }

  async removeIcon(member: MemberContext): Promise<Server> {
    const previous = await this.prisma.client.server.findUnique({
      where: { id: member.serverId },
      select: { iconUrl: true },
    });

    await this.prisma.client.server.update({
      where: { id: member.serverId },
      data: { iconUrl: null },
    });

    // Only once the row has stopped pointing at the file is it safe to delete.
    await this.icons.remove(previous?.iconUrl ?? null);

    return this.findOne(member.serverId, member.permissions);
  }

  /**
   * Deleting a server is the owner's alone — MANAGE_SERVER lets a moderator rename
   * it, not destroy it. Cascades to members, roles, channels and messages.
   */
  async remove(member: MemberContext): Promise<void> {
    if (!member.isOwner) {
      throw new ForbiddenException('Only the server owner may delete it');
    }

    const server = await this.prisma.client.server.findUnique({
      where: { id: member.serverId },
      select: { iconUrl: true },
    });

    await this.prisma.client.server.delete({ where: { id: member.serverId } });
    await this.icons.remove(server?.iconUrl ?? null);
  }

  /**
   * The owner cannot simply walk away: a server with no owner has nobody who can
   * administer it, so they delete it instead.
   */
  async leave(member: MemberContext): Promise<void> {
    if (member.isOwner) {
      throw new BadRequestException(
        'You own this server — delete it instead of leaving, or transfer it first',
      );
    }

    await this.prisma.client.serverMember.delete({ where: { id: member.memberId } });

    this.realtime.memberLeft({ serverId: member.serverId, userId: member.userId });
  }
}

function toServerSummary(server: ServerSummary): ServerSummary {
  return {
    id: server.id,
    name: server.name,
    iconUrl: server.iconUrl,
    ownerId: server.ownerId,
  };
}
