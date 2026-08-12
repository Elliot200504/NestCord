import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Env } from '../config/env';

/** Where avatars live under UPLOAD_DIR, and the URL prefix they are served from. */
export const AVATAR_SUBDIRECTORY = 'avatars';
export const AVATAR_URL_PREFIX = `/uploads/${AVATAR_SUBDIRECTORY}/`;

/**
 * Image types we accept, keyed by their leading bytes. The browser's declared
 * MIME type is a claim by the uploader; these bytes are the file itself, so this
 * is what decides — a renamed executable does not get past it.
 */
const SIGNATURES = [
  { extension: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { extension: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { extension: '.gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP is "RIFF....WEBP"; the first four bytes plus the tag at offset 8.
  { extension: '.webp', bytes: [0x52, 0x49, 0x46, 0x46], tag: { offset: 8, value: 'WEBP' } },
] as const;

/**
 * Avatar files on local disk (PLAN.MD §9). Uploads arrive in memory, are checked,
 * and only then get written under a generated name.
 */
@Injectable()
export class AvatarStorage {
  private readonly logger = new Logger(AvatarStorage.name);
  private readonly directory: string;

  constructor(config: ConfigService<Env, true>) {
    this.directory = resolve(config.get('UPLOAD_DIR', { infer: true }), AVATAR_SUBDIRECTORY);
  }

  /** Writes the upload and returns the URL to store on the user. */
  async save(file: Express.Multer.File): Promise<string> {
    const extension = detectExtension(file.buffer);

    if (!extension) {
      throw new BadRequestException('That file is not a PNG, JPEG, GIF or WEBP image');
    }

    const filename = `${randomUUID()}${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer);

    return `${AVATAR_URL_PREFIX}${filename}`;
  }

  /**
   * Deletes a previously stored avatar. Anything that is not one of our own
   * generated URLs is ignored, so a crafted value cannot reach another path.
   */
  async remove(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl?.startsWith(AVATAR_URL_PREFIX)) return;

    const filename = basename(avatarUrl);

    try {
      await unlink(join(this.directory, filename));
    } catch {
      // A missing file is the state we wanted anyway; nothing to tell the user.
      this.logger.debug(`Avatar ${filename} was already gone`);
    }
  }
}

function detectExtension(buffer: Buffer): string | null {
  const match = SIGNATURES.find((signature) => {
    const startsRight = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (!startsRight) return false;

    if (!('tag' in signature)) return true;

    return buffer.subarray(signature.tag.offset, signature.tag.offset + 4).toString() ===
      signature.tag.value;
  });

  return match?.extension ?? null;
}
