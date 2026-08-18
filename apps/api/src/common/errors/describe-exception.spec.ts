import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { Prisma } from '@nestcord/database';
import { GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

import { describeException } from './describe-exception';

/** A Prisma failure as the client throws it, without touching a database. */
function prismaError(code: string, message = 'Unique constraint failed on the fields: (`email`)') {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
  });
}

describe('describeException', () => {
  it('passes a 4xx message through, because the route wrote it for the user', () => {
    const described = describeException(new ForbiddenException('You cannot manage this channel'));

    expect(described.status).toBe(403);
    expect(described.message).toBe('You cannot manage this channel');
  });

  it('does not record a 4xx, which is the system working', () => {
    expect(describeException(new ForbiddenException('Nope')).detail).toBeNull();
  });

  it('joins the validation pipe list of bad fields into one sentence', () => {
    const described = describeException(
      new BadRequestException(['username is too short', 'email must be an email']),
    );

    expect(described.message).toBe('username is too short, email must be an email');
  });

  it('replaces a deliberate 5xx message with the generic one', () => {
    const described = describeException(new InternalServerErrorException('knex pool exhausted'));

    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.detail).toBe('knex pool exhausted');
  });

  it('turns a unique constraint violation into a conflict a user can act on', () => {
    const described = describeException(prismaError('P2002'));

    expect(described.status).toBe(409);
    expect(described.message).toBe('That already exists. Try a different value.');
  });

  it('never leaks the column name a Prisma error mentions', () => {
    const described = describeException(prismaError('P2002'));

    expect(described.message).not.toContain('email');
    // The detail is what an admin reads, so that keeps everything.
    expect(described.detail).toContain('email');
  });

  it('hides an unmapped Prisma code behind the generic message', () => {
    const described = describeException(prismaError('P2010', 'Raw query failed: syntax error'));

    expect(described.status).toBe(500);
    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.detail).toContain('P2010');
  });

  it('hides a plain crash and keeps its message for the log', () => {
    const described = describeException(new TypeError('cannot read properties of undefined'));

    expect(described.status).toBe(500);
    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.detail).toBe('cannot read properties of undefined');
  });

  it('handles something thrown that is not an Error at all', () => {
    const described = describeException('database is on fire');

    expect(described.status).toBe(500);
    expect(described.message).toBe(GENERIC_ERROR_MESSAGE);
    expect(described.detail).toBe('database is on fire');
  });
});
