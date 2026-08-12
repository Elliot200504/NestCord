import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ATTACHMENT_MIME_TYPES } from '@nestcord/shared';

import { FileStorage } from '../common/storage/file.storage';
import type { Env } from '../config/env';

/** Where message attachments live under UPLOAD_DIR, kept apart from avatars. */
export const ATTACHMENT_SUBDIRECTORY = 'attachments';

@Injectable()
export class AttachmentStorage extends FileStorage {
  constructor(config: ConfigService<Env, true>) {
    super(
      config.get('UPLOAD_DIR', { infer: true }),
      ATTACHMENT_SUBDIRECTORY,
      ATTACHMENT_MIME_TYPES,
      'That file is not a PNG, JPEG, GIF, WEBP or PDF',
    );
  }
}
