import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { createPrismaClient, type PrismaClient } from '@nestcord/database';

import type { Env } from '../../config/env';

/**
 * Thin wrapper that owns the Prisma client lifecycle. Services inject this and
 * use `prisma.client` directly — there is no repository layer in this project.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  readonly client: PrismaClient;

  constructor(config: ConfigService<Env, true>) {
    this.client = createPrismaClient(config.get('DATABASE_URL', { infer: true }));
  }

  async onModuleInit(): Promise<void> {
    await this.client.$connect();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.$disconnect();
  }
}
