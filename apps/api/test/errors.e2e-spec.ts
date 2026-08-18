import {
  BadRequestException,
  Controller,
  Get,
  type INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Prisma } from '@nestcord/database';
import { GENERIC_ERROR_MESSAGE } from '@nestcord/shared';

import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter';
import { ErrorLogService, type ErrorRecord } from '../src/common/errors/error-log.service';

/**
 * Routes that fail in each of the ways real ones do. Defined here rather than in
 * the app: the point is to prove what a client receives, and no shipped route
 * should exist purely to throw.
 */
@Controller('boom')
class BoomController {
  @Get('crash')
  crash(): never {
    throw new TypeError('cannot read properties of undefined (reading "serverId")');
  }

  @Get('prisma')
  prisma(): never {
    throw new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`email`)',
      { code: 'P2002', clientVersion: 'test' },
    );
  }

  @Get('refused')
  refused(): never {
    throw new BadRequestException('Pick a channel name with no spaces');
  }
}

/** Records what the filter tried to log, without a database. */
class RecordingErrorLog {
  readonly records: ErrorRecord[] = [];

  async record(error: ErrorRecord): Promise<string> {
    this.records.push(error);

    return `ERR-TEST${String(this.records.length).padStart(2, '0')}`;
  }
}

describe('Error responses', () => {
  let app: INestApplication;
  let errorLog: RecordingErrorLog;

  beforeEach(async () => {
    errorLog = new RecordingErrorLog();

    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [{ provide: ErrorLogService, useValue: errorLog }, AllExceptionsFilter],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(moduleRef.get(AllExceptionsFilter));

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers a crash with an apology and a reference, not with the stack', async () => {
    const response = await request(app.getHttpServer()).get('/api/boom/crash').expect(500);

    expect(response.body).toEqual({
      statusCode: 500,
      message: GENERIC_ERROR_MESSAGE,
      reference: 'ERR-TEST01',
    });
  });

  it('records the crash under the reference the client was given', async () => {
    await request(app.getHttpServer()).get('/api/boom/crash').expect(500);

    expect(errorLog.records[0]).toMatchObject({
      statusCode: 500,
      detail: 'cannot read properties of undefined (reading "serverId")',
      method: 'GET',
      path: '/api/boom/crash',
    });
    expect(errorLog.records[0]?.stack).toContain('BoomController');
  });

  it('never sends the Prisma detail to the client', async () => {
    const response = await request(app.getHttpServer()).get('/api/boom/prisma').expect(409);

    expect(response.body.message).toBe('That already exists. Try a different value.');
    expect(JSON.stringify(response.body)).not.toContain('email');
    // The admin still gets the whole thing.
    expect(errorLog.records[0]?.detail).toContain('Unique constraint failed');
  });

  it('leaves a refusal the route worded alone, and does not log it', async () => {
    const response = await request(app.getHttpServer()).get('/api/boom/refused').expect(400);

    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Pick a channel name with no spaces',
    });
    expect(errorLog.records).toHaveLength(0);
  });
});
