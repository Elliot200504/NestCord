import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  cleanCategoryName,
  has,
  Permission,
  slugifyChannelName,
  type Channel,
  type ChannelOverride,
} from '@nestcord/shared';

import { resolveChannelPermissions } from '../common/permissions/channel-overrides';
import { grantablePermissions } from '../common/permissions/grantable';
import { outranksMember, outranksPosition } from '../common/permissions/member-context';
import type { MemberContext } from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import {
  CHANNEL_OVERRIDE_SELECT,
  CHANNEL_SELECT,
  toChannel,
  toChannelOverride,
} from './channel-response';
import type { CreateChannelDto } from './dto/create-channel.dto';
import type { SetOverrideDto } from './dto/set-override.dto';
import type { UpdateChannelDto } from './dto/update-channel.dto';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  /**
   * Every channel in the server the member can actually see.
   *
   * The overrides come back with the channels in one query, so the whole sidebar is
   * resolved without a query per channel. A channel inside a category the member
   * cannot see is still listed — the category is just a heading, and hiding the
   * children with it would need a second rule nothing else has.
   */
  async list(member: MemberContext): Promise<Channel[]> {
    const channels = await this.prisma.client.channel.findMany({
      where: { serverId: member.serverId },
      select: CHANNEL_SELECT,
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
    });

    return channels
      .map((channel) => toChannel(channel, resolveChannelPermissions(member, channel.overrides)))
      .filter((channel) => has(channel.permissions, Permission.VIEW_CHANNEL));
  }

  async create(member: MemberContext, dto: CreateChannelDto): Promise<Channel> {
    const type = dto.type ?? 'TEXT';
    const name = channelName(dto.name, type);

    if (type === 'CATEGORY' && dto.parentId) {
      throw new BadRequestException('A category cannot sit inside another category');
    }

    const parentId = await this.resolveParent(member.serverId, dto.parentId ?? null);

    const channel = await this.prisma.client.channel.create({
      data: {
        serverId: member.serverId,
        name,
        type,
        topic: dto.topic ?? null,
        parentId,
        position: await this.nextPosition(member.serverId, parentId),
      },
      select: CHANNEL_SELECT,
    });

    // A brand new channel has no overrides, so the member's server-level
    // permissions are what they hold in it.
    return toChannel(channel, resolveChannelPermissions(member, channel.overrides));
  }

  /**
   * MANAGE_CHANNELS is checked *in this channel*, not just in the server, so an
   * override that takes it away here is respected.
   */
  async update(member: MemberContext, channelId: string, dto: UpdateChannelDto): Promise<Channel> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.MANAGE_CHANNELS);

    const current = await this.findInServer(member.serverId, channelId);

    if (current.type === 'CATEGORY' && dto.parentId) {
      throw new BadRequestException('A category cannot sit inside another category');
    }

    if (dto.parentId === channelId) {
      throw new BadRequestException('A channel cannot be its own category');
    }

    const parentId =
      dto.parentId === undefined
        ? undefined
        : await this.resolveParent(member.serverId, dto.parentId);

    const channel = await this.prisma.client.channel.update({
      where: { id: channelId },
      data: {
        ...(dto.name === undefined ? {} : { name: channelName(dto.name, current.type) }),
        ...(dto.topic === undefined ? {} : { topic: dto.topic }),
        ...(dto.position === undefined ? {} : { position: dto.position }),
        ...(parentId === undefined ? {} : { parentId }),
      },
      select: CHANNEL_SELECT,
    });

    return toChannel(channel, resolveChannelPermissions(member, channel.overrides));
  }

  /**
   * Deleting a category leaves the channels in it at the top level rather than
   * taking them down with it — the `parentId` relation is `SetNull` for exactly
   * that reason. Messages in a deleted channel go with it, by cascade.
   */
  async remove(member: MemberContext, channelId: string): Promise<void> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.MANAGE_CHANNELS);

    await this.prisma.client.channel.delete({ where: { id: channelId } });
  }

  /** The override list behind the channel's permission editor. */
  async overrides(member: MemberContext, channelId: string): Promise<ChannelOverride[]> {
    await this.permissions.requireChannelPermission(member, channelId, Permission.MANAGE_ROLES);

    const overrides = await this.prisma.client.channelPermission.findMany({
      where: { channelId },
      select: CHANNEL_OVERRIDE_SELECT,
    });

    return overrides.map(toChannelOverride);
  }

  async setRoleOverride(
    member: MemberContext,
    channelId: string,
    roleId: string,
    dto: SetOverrideDto,
  ): Promise<ChannelOverride[]> {
    const { allow, deny } = await this.grantableOverride(member, channelId, dto);

    const role = await this.prisma.client.role.findFirst({
      where: { id: roleId, serverId: member.serverId },
      select: { id: true, position: true },
    });

    if (!role) throw new NotFoundException('No such role');

    // Same hierarchy rule as editing the role itself: you may only change roles
    // below your own highest, so nobody can re-grant themselves through a channel.
    if (!outranksPosition(member, role.position)) {
      throw new ForbiddenException('That role is at or above your highest role');
    }

    if (allow === 0 && deny === 0) {
      await this.prisma.client.channelPermission.deleteMany({ where: { channelId, roleId } });
    } else {
      await this.prisma.client.channelPermission.upsert({
        where: { channelId_roleId: { channelId, roleId } },
        update: { allow, deny },
        create: { channelId, roleId, type: 'ROLE', allow, deny },
      });
    }

    return this.overrides(member, channelId);
  }

  async setMemberOverride(
    member: MemberContext,
    channelId: string,
    userId: string,
    dto: SetOverrideDto,
  ): Promise<ChannelOverride[]> {
    const { allow, deny } = await this.grantableOverride(member, channelId, dto);

    const target = await this.permissions.findMemberContext(member.serverId, userId);

    if (!target) throw new NotFoundException('That user is not a member of this server');

    if (target.userId !== member.userId && !outranksMember(member, target)) {
      throw new ForbiddenException('That member is the same rank as you or higher');
    }

    if (allow === 0 && deny === 0) {
      await this.prisma.client.channelPermission.deleteMany({ where: { channelId, userId } });
    } else {
      await this.prisma.client.channelPermission.upsert({
        where: { channelId_userId: { channelId, userId } },
        update: { allow, deny },
        create: { channelId, userId, type: 'MEMBER', allow, deny },
      });
    }

    return this.overrides(member, channelId);
  }

  /**
   * Every override write shares the same three checks, so they live in one place:
   * MANAGE_ROLES in this channel, no flag in both halves, and nothing granted that
   * the caller does not hold here.
   */
  private async grantableOverride(
    member: MemberContext,
    channelId: string,
    dto: SetOverrideDto,
  ): Promise<{ allow: number; deny: number }> {
    const here = await this.permissions.requireChannelPermission(
      member,
      channelId,
      Permission.MANAGE_ROLES,
    );

    if ((dto.allow & dto.deny) !== 0) {
      throw new BadRequestException('A permission cannot be allowed and denied at the same time');
    }

    // Checked against what the caller holds *in this channel*: an override they are
    // already denied here is not theirs to hand out.
    return {
      allow: grantablePermissions(here, dto.allow),
      deny: grantablePermissions(here, dto.deny),
    };
  }

  /** Scoped by server so a channel id from elsewhere cannot be reached. */
  private async findInServer(serverId: string, channelId: string) {
    const channel = await this.prisma.client.channel.findFirst({
      where: { id: channelId, serverId },
      select: { id: true, type: true },
    });

    if (!channel) throw new NotFoundException('No such channel');

    return channel;
  }

  /** A parent has to be a category in the same server, or there is no parent. */
  private async resolveParent(serverId: string, parentId: string | null): Promise<string | null> {
    if (parentId === null) return null;

    const parent = await this.prisma.client.channel.findFirst({
      where: { id: parentId, serverId, type: 'CATEGORY' },
      select: { id: true },
    });

    if (!parent) throw new NotFoundException('No such category');

    return parent.id;
  }

  /** New channels go to the bottom of their category. */
  private async nextPosition(serverId: string, parentId: string | null): Promise<number> {
    const last = await this.prisma.client.channel.findFirst({
      where: { serverId, parentId },
      select: { position: true },
      orderBy: { position: 'desc' },
    });

    return last ? last.position + 1 : 0;
  }
}

/** Text and voice channels are addressed as `#like-this`; categories are headings. */
function channelName(input: string, type: 'TEXT' | 'VOICE' | 'CATEGORY'): string {
  const name = type === 'CATEGORY' ? cleanCategoryName(input) : slugifyChannelName(input);

  if (!name) {
    throw new BadRequestException('That name has no letters or numbers in it');
  }

  return name;
}
