import { randomBytes } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { ERROR_LOG_PAGE_SIZE, type ErrorLogEntry } from '@nestcord/shared';

import { PrismaService } from '../prisma/prisma.service';

/**
 * How many references to try before giving up and using the last one anyway.
 * Matches the invite-code generator, for the same reason.
 */
const REFERENCE_ATTEMPTS = 5;

/** What the exception filter knows about a failure worth recording. */
export interface ErrorRecord {
  statusCode: number;
  /** The real message. Only ever leaves the server through the admin routes. */
  detail: string;
  stack?: string | undefined;
  method: string;
  path: string;
  userId?: string | null;
}

/**
 * The error log: the other half of showing users a friendly message.
 *
 * If the client is told nothing but "something went wrong", the detail has to
 * survive somewhere an admin can read it — otherwise a report of "it broke" is
 * unanswerable. Lives in `common/` because the exception filter that writes it is
 * global and belongs to no feature.
 */
@Injectable()
export class ErrorLogService {
  private readonly logger = new Logger(ErrorLogService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record one failure and return the reference the user will be shown.
   *
   * Never throws. The request has already failed; failing to write the log row
   * must not replace the response with a second, more confusing error — and the
   * detail is always logged to stdout too, so nothing is lost even when the
   * database is the thing that is broken.
   */
  async record(error: ErrorRecord): Promise<string> {
    const reference = await this.reserveReference();

    this.logger.error(
      `[${reference}] ${error.method} ${error.path} → ${String(error.statusCode)}: ${error.detail}`,
      error.stack,
    );

    try {
      await this.prisma.client.errorLog.create({
        data: {
          reference,
          statusCode: error.statusCode,
          detail: error.detail,
          stack: error.stack ?? null,
          method: error.method,
          path: error.path,
          userId: error.userId ?? null,
        },
      });
    } catch (cause) {
      this.logger.error(
        `Could not write error ${reference} to the log`,
        cause instanceof Error ? cause.stack : undefined,
      );
    }

    return reference;
  }

  /**
   * A reference no row is using yet.
   *
   * `reference` is unique, so a collision made `create` throw — and because this
   * service deliberately swallows that failure, the user was still handed a code
   * with no row behind it, which then 404s when support looks it up. Only 16.7M
   * codes exist, so a duplicate is a matter of when, not if.
   *
   * Same find-then-create shape as invite codes. Never throws: after the last
   * attempt it hands back the final candidate and lets `record` try the write,
   * because a possibly-duplicate reference is still better than no log row.
   */
  private async reserveReference(): Promise<string> {
    let reference = createReference();

    for (let attempt = 1; attempt < REFERENCE_ATTEMPTS; attempt += 1) {
      const taken = await this.prisma.client.errorLog.findUnique({
        where: { reference },
        select: { reference: true },
      });

      if (!taken) return reference;

      this.logger.warn(`Error reference ${reference} is taken; generating another`);
      reference = createReference();
    }

    return reference;
  }

  /**
   * One page of the log, newest first. Cursor is a row id, so a page boundary
   * cannot skip or repeat a row while new errors keep arriving — the same paging
   * rule the audit log follows.
   */
  async list(cursor?: string): Promise<ErrorLogEntry[]> {
    const rows = await this.prisma.client.errorLog.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ERROR_LOG_PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });

    return rows.map(toEntry);
  }

  /** One row by the reference a user quoted. Null when the code was mistyped. */
  async findByReference(reference: string): Promise<ErrorLogEntry | null> {
    const row = await this.prisma.client.errorLog.findUnique({ where: { reference } });

    return row === null ? null : toEntry(row);
  }
}

/**
 * Short, unambiguous, and read aloud over the phone as often as copied: no O/0 or
 * I/1 confusion because hex has none of those letters, and short enough that a
 * user will actually include it in their report.
 */
function createReference(): string {
  return `ERR-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function toEntry(row: {
  id: string;
  reference: string;
  statusCode: number;
  detail: string;
  stack: string | null;
  method: string;
  path: string;
  userId: string | null;
  createdAt: Date;
}): ErrorLogEntry {
  return {
    id: row.id,
    reference: row.reference,
    statusCode: row.statusCode,
    detail: row.detail,
    stack: row.stack,
    method: row.method,
    path: row.path,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
  };
}
