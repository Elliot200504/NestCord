import { resolve } from 'node:path';

import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.use(
    helmet({
      // Avatars are served from this origin and displayed on the web app's, which
      // helmet's default `same-origin` policy would block.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  // The refresh token travels as an httpOnly cookie, so cookies must be parsed.
  app.use(cookieParser());
  app.setGlobalPrefix('api');

  // Uploaded files (avatars today, attachments in a later phase) are served
  // straight off disk — no CDN, no bucket, exactly as PLAN.MD §9 asks for.
  app.useStaticAssets(resolve(config.get('UPLOAD_DIR', { infer: true })), {
    prefix: '/uploads',
    // Generated filenames never change contents, so they can be cached hard.
    maxAge: '7d',
    index: false,
  });

  // Locked to the web app's origin — never a wildcard with credentials.
  app.enableCors({
    origin: config.get('WEB_URL', { infer: true }),
    credentials: true,
  });

  // Unknown fields are rejected rather than silently ignored.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('NestCord API')
    .setDescription('REST API for the NestCord chat application')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, swaggerConfig));

  app.enableShutdownHooks();

  const port = config.get('API_PORT', { infer: true });
  await app.listen(port);

  Logger.log(`API listening on http://localhost:${port}/api`, 'Bootstrap');
  Logger.log(`Swagger UI on http://localhost:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
