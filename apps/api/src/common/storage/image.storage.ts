import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { BadRequestException, Logger } from '@nestjs/common';

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

/** The URL an image stored under `subdirectory` is served from. */
export function imageUrlPrefix(subdirectory: string): string {
  return `/uploads/${subdirectory}/`;
}

/**
 * Image files on local disk (PLAN.MD §9). Uploads arrive in memory, are checked,
 * and only then get written under a generated name.
 *
 * Not injectable itself: each kind of image gets a tiny `@Injectable()` subclass
 * that picks its own subdirectory, so avatars and server icons share this code
 * without sharing a folder.
 */
export class ImageStorage {
  private readonly logger = new Logger(ImageStorage.name);
  private readonly directory: string;
  private readonly urlPrefix: string;

  constructor(uploadDir: string, subdirectory: string) {
    this.directory = resolve(uploadDir, subdirectory);
    this.urlPrefix = imageUrlPrefix(subdirectory);
  }

  /** Writes the upload and returns the URL to store on the row that owns it. */
  async save(file: Express.Multer.File): Promise<string> {
    const extension = detectExtension(file.buffer);

    if (!extension) {
      throw new BadRequestException('That file is not a PNG, JPEG, GIF or WEBP image');
    }

    const filename = `${randomUUID()}${extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer);

    return `${this.urlPrefix}${filename}`;
  }

  /**
   * Deletes a previously stored image. Anything that is not one of our own
   * generated URLs is ignored, so a crafted value cannot reach another path.
   */
  async remove(url: string | null): Promise<void> {
    if (!url?.startsWith(this.urlPrefix)) return;

    const filename = basename(url);

    try {
      await unlink(join(this.directory, filename));
    } catch {
      // A missing file is the state we wanted anyway; nothing to tell the user.
      this.logger.debug(`${filename} was already gone`);
    }
  }
}

function detectExtension(buffer: Buffer): string | null {
  const match = SIGNATURES.find((signature) => {
    const startsRight = signature.bytes.every((byte, index) => buffer[index] === byte);
    if (!startsRight) return false;

    if (!('tag' in signature)) return true;

    return (
      buffer.subarray(signature.tag.offset, signature.tag.offset + 4).toString() ===
      signature.tag.value
    );
  });

  return match?.extension ?? null;
}
