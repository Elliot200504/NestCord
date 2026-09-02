import { describe, expect, it } from 'vitest';

import { MESSAGE_MAX_ATTACHMENTS } from '@nestcord/shared';

import type { StoredFile } from '../common/storage/file.storage';
import type { PrismaService } from '../common/prisma/prisma.service';
import type { AttachmentStorage } from './attachment.storage';
import { AttachmentsService } from './attachments.service';

const UPLOADER = 'user-ada';

interface StubRow {
  id: string;
  uploaderId: string;
  messageId: string | null;
}

interface CreatedRow {
  uploaderId: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}

/**
 * Stands in for the two counting queries and the disk. What is under test is the
 * claim rule and the filename handling, not the query — see the note in
 * `common/testing/fake-prisma.ts`.
 */
function buildHarness(rows: StubRow[] = []) {
  const created: CreatedRow[] = [];
  const removed: Array<string | null> = [];

  const prisma = {
    client: {
      attachment: {
        create: async ({ data }: { data: CreatedRow }) => {
          created.push(data);

          return { id: 'attachment-new', ...data };
        },
        // Applies exactly the filters it is handed and nothing more, the way
        // Prisma would. Hardcoding the uploader and messageId rules here instead
        // would make this stub enforce them, and the tests below would then pass
        // even if the service stopped asking for them.
        count: async ({
          where,
        }: {
          where: { id: { in: string[] }; uploaderId?: string; messageId?: string | null };
        }) =>
          rows.filter(
            (row) =>
              where.id.in.includes(row.id) &&
              (where.uploaderId === undefined || row.uploaderId === where.uploaderId) &&
              (!('messageId' in where) || row.messageId === where.messageId),
          ).length,
      },
    },
  } as unknown as PrismaService;

  const storage = {
    store: async (file: Express.Multer.File): Promise<StoredFile> => ({
      // The type read out of the bytes, never the uploader's claim.
      url: '/uploads/attachments/generated-name.png',
      mimeType: 'image/png',
      size: file.size,
    }),
    remove: async (url: string | null) => {
      removed.push(url);
    },
  } as unknown as AttachmentStorage;

  return { service: new AttachmentsService(prisma, storage), created, removed };
}

function file(originalname: string, size = 1024): Express.Multer.File {
  return { originalname, size, mimetype: 'image/png' } as Express.Multer.File;
}

describe('AttachmentsService', () => {
  describe('upload', () => {
    it('records the file against its uploader, unclaimed', async () => {
      const harness = buildHarness();

      const attachment = await harness.service.upload(UPLOADER, file('holiday.png'));

      expect(harness.created).toEqual([
        {
          uploaderId: UPLOADER,
          filename: 'holiday.png',
          mimeType: 'image/png',
          size: 1024,
          url: '/uploads/attachments/generated-name.png',
        },
      ]);
      expect(attachment.url).toBe('/uploads/attachments/generated-name.png');
    });

    it('keeps the type the bytes say, not the one the uploader claimed', async () => {
      const harness = buildHarness();
      const claimed = { ...file('script.png'), mimetype: 'application/x-executable' };

      await harness.service.upload(UPLOADER, claimed as Express.Multer.File);

      expect(harness.created[0]?.mimeType).toBe('image/png');
    });

    it('never returns the uploader id to the client', async () => {
      const harness = buildHarness();

      const attachment = await harness.service.upload(UPLOADER, file('holiday.png'));

      expect(attachment).not.toHaveProperty('uploaderId');
    });

    it('flattens newlines and tabs out of a displayed filename', async () => {
      const harness = buildHarness();

      await harness.service.upload(UPLOADER, file('two\nlines\tand a tab.png'));

      expect(harness.created[0]?.filename).toBe('two lines and a tab.png');
    });

    it('trims an absurdly long filename to something displayable', async () => {
      const harness = buildHarness();

      await harness.service.upload(UPLOADER, file(`${'a'.repeat(500)}.png`));

      expect(harness.created[0]?.filename).toHaveLength(120);
    });

    it('falls back to "file" when the name is empty or only whitespace', async () => {
      const harness = buildHarness();

      await harness.service.upload(UPLOADER, file('   '));

      expect(harness.created[0]?.filename).toBe('file');
    });
  });

  describe('requireClaimable', () => {
    it('allows a message with no attachments without asking the database', async () => {
      const harness = buildHarness();

      await expect(harness.service.requireClaimable(UPLOADER, [])).resolves.toBeUndefined();
    });

    it('allows the uploader to claim their own unsent files', async () => {
      const harness = buildHarness([
        { id: 'a1', uploaderId: UPLOADER, messageId: null },
        { id: 'a2', uploaderId: UPLOADER, messageId: null },
      ]);

      await expect(
        harness.service.requireClaimable(UPLOADER, ['a1', 'a2']),
      ).resolves.toBeUndefined();
    });

    it('refuses somebody else’s upload', async () => {
      // The whole point: knowing an id must not be enough to attach it.
      const harness = buildHarness([{ id: 'a1', uploaderId: 'user-grace', messageId: null }]);

      await expect(harness.service.requireClaimable(UPLOADER, ['a1'])).rejects.toThrow(
        'Those attachments are not yours to attach, or already sent',
      );
    });

    it('refuses a file that is already on a message', async () => {
      const harness = buildHarness([
        { id: 'a1', uploaderId: UPLOADER, messageId: 'message-earlier' },
      ]);

      await expect(harness.service.requireClaimable(UPLOADER, ['a1'])).rejects.toThrow(
        'not yours to attach, or already sent',
      );
    });

    it('refuses the whole batch when only one id is not claimable', async () => {
      const harness = buildHarness([
        { id: 'a1', uploaderId: UPLOADER, messageId: null },
        { id: 'a2', uploaderId: 'user-grace', messageId: null },
      ]);

      await expect(harness.service.requireClaimable(UPLOADER, ['a1', 'a2'])).rejects.toThrow(
        'not yours to attach',
      );
    });

    it('refuses an id that does not exist', async () => {
      const harness = buildHarness();

      await expect(harness.service.requireClaimable(UPLOADER, ['ghost'])).rejects.toThrow(
        'not yours to attach',
      );
    });

    it('refuses more files than a message may carry', async () => {
      const ids = Array.from({ length: MESSAGE_MAX_ATTACHMENTS + 1 }, (_, index) => `a${index}`);
      const harness = buildHarness(
        ids.map((id) => ({ id, uploaderId: UPLOADER, messageId: null })),
      );

      await expect(harness.service.requireClaimable(UPLOADER, ids)).rejects.toThrow(
        `A message takes at most ${MESSAGE_MAX_ATTACHMENTS} files`,
      );
    });

    it('allows exactly the maximum', async () => {
      const ids = Array.from({ length: MESSAGE_MAX_ATTACHMENTS }, (_, index) => `a${index}`);
      const harness = buildHarness(
        ids.map((id) => ({ id, uploaderId: UPLOADER, messageId: null })),
      );

      await expect(harness.service.requireClaimable(UPLOADER, ids)).resolves.toBeUndefined();
    });

    it('refuses a duplicated id, which would otherwise pass the count', async () => {
      // One row, two references: the count matches the length only by accident.
      const harness = buildHarness([{ id: 'a1', uploaderId: UPLOADER, messageId: null }]);

      await expect(harness.service.requireClaimable(UPLOADER, ['a1', 'a1'])).rejects.toThrow(
        'not yours to attach',
      );
    });
  });

  describe('removeFiles', () => {
    it('deletes every file behind a message that is going away', async () => {
      const harness = buildHarness();

      await harness.service.removeFiles(['/uploads/attachments/one.png', '/uploads/two.png']);

      expect(harness.removed).toEqual(['/uploads/attachments/one.png', '/uploads/two.png']);
    });

    it('does nothing when a message had no files', async () => {
      const harness = buildHarness();

      await harness.service.removeFiles([]);

      expect(harness.removed).toEqual([]);
    });
  });
});
