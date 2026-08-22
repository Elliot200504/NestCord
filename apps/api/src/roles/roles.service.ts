import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { type ServerRole } from '@nestcord/shared';

import { AuditLogService } from '../common/audit/audit-log.service';
import { grantablePermissions } from '../common/permissions/grantable';
import {
  outranksMember,
  outranksPosition,
  type MemberContext,
} from '../common/permissions/member-context';
import { PermissionsService } from '../common/permissions/permissions.service';
import { PrismaService } from '../common/prisma/prisma.service';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateRoleDto } from './dto/update-role.dto';
import { ROLE_SELECT, toServerRole } from './role-response';

/**
 * New roles sit just above `@everyone`; reordering is a separate edit. Anyone who
 * can manage roles at all is above this, except a member whose own top role is here.
 */
const NEW_ROLE_POSITION = 1;

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditLogService,
  ) {}

  async list(serverId: string): Promise<ServerRole[]> {
    const roles = await this.prisma.client.role.findMany({
      where: { serverId },
      select: ROLE_SELECT,
      orderBy: { position: 'desc' },
    });

    return roles.map(toServerRole);
  }

  async create(actor: MemberContext, dto: CreateRoleDto): Promise<ServerRole> {
    // A new role has to land somewhere the creator can still manage it, which means
    // strictly below their own highest. Anyone whose top role already sits on the
    // floor has no room, and gets told that rather than a confusing hierarchy error.
    if (!outranksPosition(actor, NEW_ROLE_POSITION)) {
      throw new ForbiddenException(
        'Your highest role is too low to create a role beneath it — you need a role above the bottom of the list',
      );
    }

    // Checked before the write, so a rejected escalation attempt creates nothing.
    const permissions = grantablePermissions(actor.permissions, dto.permissions ?? 0);

    const role = await this.prisma.client.role.create({
      data: {
        serverId: actor.serverId,
        name: dto.name,
        color: dto.color ?? null,
        permissions,
        position: NEW_ROLE_POSITION,
        isDefault: false,
      },
      select: ROLE_SELECT,
    });

    await this.audit.record({
      serverId: actor.serverId,
      actorId: actor.userId,
      action: 'ROLE_CREATE',
      targetId: role.id,
    });

    return toServerRole(role);
  }

  async update(actor: MemberContext, roleId: string, dto: UpdateRoleDto): Promise<ServerRole> {
    const role = await this.findInServer(actor.serverId, roleId);

    // Both the current and the requested position must be within reach, so a role
    // cannot be dragged out of your control or edited from above it.
    this.assertCanReachPosition(actor, role.position);
    if (dto.position !== undefined) this.assertCanReachPosition(actor, dto.position);

    if (role.isDefault && dto.position !== undefined && dto.position !== role.position) {
      throw new BadRequestException('@everyone must stay at the bottom of the list');
    }

    if (role.isDefault && dto.name !== undefined && dto.name !== role.name) {
      throw new BadRequestException('@everyone cannot be renamed');
    }

    const updated = await this.prisma.client.role.update({
      where: { id: role.id },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name }),
        ...(dto.color === undefined ? {} : { color: dto.color }),
        ...(dto.position === undefined ? {} : { position: dto.position }),
        ...(dto.permissions === undefined
          ? {}
          : { permissions: grantablePermissions(actor.permissions, dto.permissions) }),
      },
      select: ROLE_SELECT,
    });

    return toServerRole(updated);
  }

  /** Deleting a role drops it from every member through the `MemberRole` cascade. */
  async remove(actor: MemberContext, roleId: string): Promise<void> {
    const role = await this.findInServer(actor.serverId, roleId);

    if (role.isDefault) {
      throw new BadRequestException('@everyone cannot be deleted');
    }

    this.assertCanReachPosition(actor, role.position);

    await this.prisma.client.role.delete({ where: { id: role.id } });

    await this.audit.record({
      serverId: actor.serverId,
      actorId: actor.userId,
      action: 'ROLE_DELETE',
      targetId: role.id,
    });
  }

  async assign(actor: MemberContext, targetUserId: string, roleId: string): Promise<void> {
    const { target, role } = await this.resolveAssignment(actor, targetUserId, roleId);

    // Handing out a role hands out its permissions, so the rule that guards creating
    // and editing one guards this too. Hierarchy alone is not enough: a role below
    // your own highest can still carry ADMINISTRATOR, and assigning it — to anyone,
    // including yourself — would be MANAGE_ROLES turned into a way to take the server.
    grantablePermissions(actor.permissions, role.permissions);

    await this.prisma.client.memberRole.upsert({
      where: { memberId_roleId: { memberId: target.memberId, roleId: role.id } },
      // Already assigned is the state the caller asked for, so this is a no-op
      // rather than a conflict.
      update: {},
      create: { memberId: target.memberId, roleId: role.id },
    });
  }

  async unassign(actor: MemberContext, targetUserId: string, roleId: string): Promise<void> {
    const { target, role } = await this.resolveAssignment(actor, targetUserId, roleId);

    if (role.isDefault) {
      throw new BadRequestException('@everyone cannot be taken away');
    }

    await this.prisma.client.memberRole.deleteMany({
      where: { memberId: target.memberId, roleId: role.id },
    });
  }

  private async resolveAssignment(actor: MemberContext, targetUserId: string, roleId: string) {
    const role = await this.findInServer(actor.serverId, roleId);
    const target = await this.permissions.findMemberContext(actor.serverId, targetUserId);

    if (!target) throw new NotFoundException('That user is not a member of this server');

    // Two separate checks: the role must be below you, and so must the member. The
    // first stops a role being dragged out of your control; the second stops editing
    // a peer's roles at all. What the role *grants* is checked by the caller, since
    // taking one away is not a grant.
    this.assertCanReachPosition(actor, role.position);

    if (target.userId !== actor.userId && !outranksMember(actor, target)) {
      throw new ForbiddenException('That member is the same rank as you or higher');
    }

    return { target, role };
  }

  private async findInServer(serverId: string, roleId: string) {
    const role = await this.prisma.client.role.findFirst({
      // Scoped by server so a role id from elsewhere cannot be reached.
      where: { id: roleId, serverId },
      select: ROLE_SELECT,
    });

    if (!role) throw new NotFoundException('No such role');

    return role;
  }

  /** Hierarchy: you may only touch roles strictly below your own highest. */
  private assertCanReachPosition(actor: MemberContext, position: number): void {
    if (!outranksPosition(actor, position)) {
      throw new ForbiddenException('That role is at or above your highest role');
    }
  }
}
