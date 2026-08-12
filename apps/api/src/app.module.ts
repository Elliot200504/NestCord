import { join } from 'node:path';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { ChannelsModule } from './channels/channels.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { validateEnv } from './config/env';
import { HealthModule } from './health/health.module';
import { RolesModule } from './roles/roles.module';
import { ServersModule } from './servers/servers.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // One .env at the workspace root rather than one per package.
      envFilePath: join(__dirname, '../../../.env'),
      validate: validateEnv,
    }),
    // In-memory rate limiting is enough for a few hundred users (PLAN.MD §23).
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    ServersModule,
    RolesModule,
    ChannelsModule,
    HealthModule,
  ],
  // Rate limiting runs first, then authentication. Authentication is global so a
  // new route is protected unless it opts out with @Public().
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
