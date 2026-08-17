import { Injectable, Logger } from '@nestjs/common';

import { AUDIT_LOG_PAGE_SIZE, type AuditAction, type AuditLogEntry } from '@nestcord/shared';

import { PUBLIC_USER_SELECT, toPublicUser } from '../../auth/public-user';
import { PrismaService } from '../prisma/prisma.service';

/** What a caller has to tell us to record one entry. */
export interface AuditRecord {
  serverId: string;
  actorId: string;
  action: AuditAction;
  /** The user, message, channel or role that was acted on. */
  targetId?: string | null;
  reason?: string | null;
}

const ENTRY_SELECT = {
  id: true,
  action: true,
  targetId: true,
  reason: true,
  createdAt: true,
  actor: { select: PUBLIC_USER_SELECT },
} as const;

/** Which actions point at a user, and so can have their target resolved to one. */
const USER_ACTIONS: ReadonlySet<AuditAction> = new Set<AuditAction>([
  'MEMBER_KICK',
  'MEMBER_BAN',
  'MEMBER_UNBAN',
]);

/**
 * The audit log. Lives in `common/` rather than in `servers/` because moderation
 * happens in four different modules — members, messages, channels and roles — and
 * none of them should have to import another feature module to write one row.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write one entry.
   *
   * Deliberately never throws: the moderation action it describes has already
   * happened, and failing the request afterwards would tell the moderator their
   * kick did not work when it did. A lost row is logged and nothing else.
   */
  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.prisma.client.auditLog.create({
        data: {
          serverId: entry.serverId,
          actorId: entry.actorId,
          action: entry.action,
          targetId: entry.targetId ?? null,
          reason: entry.reason ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Could not record ${entry.action} in server ${entry.serverId}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * One page of the log, newest first. Cursor is an entry id, so paging cannot
   * skip or repeat a row when new entries land while somebody is reading.
   */
  async list(serverId: string, cursor?: string): Promise<AuditLogEntry[]> {
    const entries = await this.prisma.client.auditLog.findMany({
      where: { serverId },
      select: ENTRY_SELECT,
      // Id breaks ties, the same way message history does it: a page boundary that
      // falls between two entries written in the same millisecond would otherwise
      // skip or repeat one, and moderation actions arrive in bursts.
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: AUDIT_LOG_PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    return this.resolveTargets(entries);
  }

  /**
   * Attach the target user to the entries that have one. A single extra query for
   * the whole page: the alternative is a join per row, and most pages mention the
   * same a handful of people over and over.
   */
  private async resolveTargets(entries: EntryRow[]): Promise<AuditLogEntry[]> {
    const userIds = entries.flatMap((entry) =>
      USER_ACTIONS.has(entry.action) && entry.targetId !== null ? [entry.targetId] : [],
    );

    const users =
      userIds.length === 0
        ? []
        : await this.prisma.client.user.findMany({
            where: { id: { in: [...new Set(userIds)] } },
            select: PUBLIC_USER_SELECT,
          });

    const byId = new Map(users.map((user) => [user.id, toPublicUser(user)]));

    return entries.map((entry) => ({
      id: entry.id,
      action: entry.action,
      actor: toPublicUser(entry.actor),
      // Null for a deleted account as much as for a non-user action: either way
      // the id below is all we can honestly show.
      targetUser: (entry.targetId === null ? undefined : byId.get(entry.targetId)) ?? null,
      targetId: entry.targetId,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    }));
  }
}

interface EntryRow {
  id: string;
  action: AuditAction;
  targetId: string | null;
  reason: string | null;
  createdAt: Date;
  actor: Parameters<typeof toPublicUser>[0];
}
