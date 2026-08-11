import { mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Env } from '../config/env';
import { AVATAR_SUBDIRECTORY, AvatarStorage } from './avatar.storage';

/** Bytes that make a file look like each format we accept. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const GIF = Buffer.from('GIF89a');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);

function upload(buffer: Buffer): Express.Multer.File {
  return { buffer } as Express.Multer.File;
}

describe('AvatarStorage', () => {
  let directory: string;
  let storage: AvatarStorage;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'nestcord-avatars-'));
    // The storage only ever reads UPLOAD_DIR, so a one-key stand-in is honest.
    storage = new AvatarStorage({ get: () => directory } as unknown as ConfigService<Env, true>);
  });

  it.each([
    ['PNG', PNG, '.png'],
    ['JPEG', JPEG, '.jpg'],
    ['GIF', GIF, '.gif'],
    ['WEBP', WEBP, '.webp'],
  ])('accepts a %s and names it by its real type', async (_name, bytes, extension) => {
    const url = await storage.save(upload(bytes));

    expect(url.endsWith(extension)).toBe(true);
    await expect(readdir(join(directory, AVATAR_SUBDIRECTORY))).resolves.toHaveLength(1);
  });

  it('rejects a file that is not an image, whatever it claims to be', async () => {
    await expect(storage.save(upload(Buffer.from('<?php echo "hi"; ?>')))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('ignores the uploader’s filename entirely', async () => {
    const url = await storage.save({
      buffer: PNG,
      originalname: '../../etc/passwd.png',
    } as Express.Multer.File);

    expect(url).not.toContain('..');
    expect(url).not.toContain('passwd');
  });

  it('deletes a file it stored', async () => {
    const url = await storage.save(upload(PNG));

    await storage.remove(url);

    await expect(readdir(join(directory, AVATAR_SUBDIRECTORY))).resolves.toHaveLength(0);
  });

  it('refuses to delete anything outside its own directory', async () => {
    const bystander = join(directory, 'important.txt');
    await writeFile(bystander, 'do not delete me');

    await storage.remove('/etc/passwd');
    await storage.remove('../important.txt');

    await expect(readFile(bystander, 'utf8')).resolves.toBe('do not delete me');
  });
});
