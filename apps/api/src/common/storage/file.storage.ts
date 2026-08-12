import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { BadRequestException, Logger } from '@nestjs/common';

/**
 * A file type we accept, recognised by its leading bytes.
 *
 * The browser's declared MIME type is a claim by the uploader; these bytes are the
 * file itself, so this is what decides — a renamed executable does not get past it.
 */
interface FileSignature {
  extension: string;
  mimeType: string;
  bytes: readonly number[];
  /** A second marker further into the file, for formats that need one. */
  tag?: { offset: number; value: string };
}

const SIGNATURES: readonly FileSignature[] = [
  { extension: '.png', mimeType: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { extension: '.jpg', mimeType: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { extension: '.gif', mimeType: 'image/gif', bytes: [0x47, 0x49, 0x46, 0x38] },
  // WEBP is "RIFF....WEBP"; the first four bytes plus the tag at offset 8.
  {
    extension: '.webp',
    mimeType: 'image/webp',
    bytes: [0x52, 0x49, 0x46, 0x46],
    tag: { offset: 8, value: 'WEBP' },
  },
  // "%PDF-"
  { extension: '.pdf', mimeType: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
];

/** What a stored file became on disk, as the row that owns it records it. */
export interface StoredFile {
  /** The URL to serve it from. */
  url: string;
  /** The type read out of the file's own bytes — never the uploader's claim. */
  mimeType: string;
  size: number;
}

/** The URL a file stored under `subdirectory` is served from. */
export function fileUrlPrefix(subdirectory: string): string {
  return `/uploads/${subdirectory}/`;
}

/**
 * Uploaded files on local disk (PLAN.MD §9). Uploads arrive in memory, are checked,
 * and only then get written under a generated name.
 *
 * Not injectable itself: each kind of upload gets a tiny `@Injectable()` subclass
 * that picks its own subdirectory and the types it accepts, so avatars, server icons
 * and message attachments share this code without sharing a folder or an allowlist.
 */
export class FileStorage {
  private readonly logger = new Logger(FileStorage.name);
  private readonly directory: string;
  private readonly urlPrefix: string;

  constructor(
    uploadDir: string,
    subdirectory: string,
    /** MIME types this storage will accept, checked against the file's own bytes. */
    private readonly accepted: readonly string[],
    /** What to tell the user when the bytes are not one of them. */
    private readonly rejection: string,
  ) {
    this.directory = resolve(uploadDir, subdirectory);
    this.urlPrefix = fileUrlPrefix(subdirectory);
  }

  /** Writes the upload and returns what the owning row needs to record. */
  async store(file: Express.Multer.File): Promise<StoredFile> {
    const signature = this.detect(file.buffer);

    if (!signature) throw new BadRequestException(this.rejection);

    const filename = `${randomUUID()}${signature.extension}`;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, filename), file.buffer);

    return {
      url: `${this.urlPrefix}${filename}`,
      mimeType: signature.mimeType,
      size: file.buffer.byteLength,
    };
  }

  /**
   * Deletes a previously stored file. Anything that is not one of our own generated
   * URLs is ignored, so a crafted value cannot reach another path.
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

  private detect(buffer: Buffer): FileSignature | null {
    const match = SIGNATURES.filter((signature) => this.accepted.includes(signature.mimeType)).find(
      (signature) => {
        const startsRight = signature.bytes.every((byte, index) => buffer[index] === byte);
        if (!startsRight) return false;

        if (!signature.tag) return true;

        return (
          buffer.subarray(signature.tag.offset, signature.tag.offset + 4).toString() ===
          signature.tag.value
        );
      },
    );

    return match ?? null;
  }
}
