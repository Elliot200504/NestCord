import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../common/prisma/prisma.service';
import type { Env } from '../config/env';

/**
 * Who counts as an admin.
 *
 * The list is an environment variable rather than a column: for an app this size
 * there are one or two admins, they change about never, and keeping the answer out
 * of the database means no route can accidentally grant it.
 */
@Injectable()
export class AdminService {
  private readonly emails: ReadonlySet<string>;

  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    this.emails = parseEmails(config.get('ADMIN_EMAILS', { infer: true }));
  }

  /**
   * The email is read from the database, not from the token: `RequestUser` carries
   * only public fields, and putting an email in a JWT would mean a demoted admin
   * kept their access until the token expired.
   */
  async isAdmin(userId: string): Promise<boolean> {
    if (this.emails.size === 0) return false;

    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    return user !== null && this.emails.has(user.email.toLowerCase());
  }
}

/** Comma-separated, lower-cased, blanks dropped — a trailing comma is not an admin. */
function parseEmails(raw: string): ReadonlySet<string> {
  return new Set(
    raw
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.length > 0),
  );
}
