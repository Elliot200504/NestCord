import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { FakePrisma } from '../common/testing/fake-prisma';
import { AvatarStorage } from './avatar.storage';
import { PresenceService } from '../gateway/presence.service';
import { RealtimeService } from '../gateway/realtime.service';
import { UsersService } from './users.service';

const ENV: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'a'.repeat(48),
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '30d',
  UPLOAD_DIR: './uploads-test',
};

const CREDENTIALS = { username: 'ada', email: 'ada@nestcord.local', password: 'password123' };

/** Records what would have hit the disk, so no test writes a file. */
class RecordingAvatarStorage {
  saved: string[] = [];
  removed: (string | null)[] = [];

  async save(): Promise<string> {
    const url = `/uploads/avatars/avatar-${this.saved.length + 1}.png`;
    this.saved.push(url);
    return url;
  }

  async remove(url: string | null): Promise<void> {
    this.removed.push(url);
  }
}

interface Harness {
  users: UsersService;
  auth: AuthService;
  prisma: FakePrisma;
  avatars: RecordingAvatarStorage;
}

async function buildHarness(): Promise<Harness> {
  const prisma = new FakePrisma();
  const avatars = new RecordingAvatarStorage();

  const moduleRef = await Test.createTestingModule({
    providers: [
      UsersService,
      AuthService,
      JwtService,
      { provide: PrismaService, useValue: prisma.asPrismaService() },
      { provide: AvatarStorage, useValue: avatars },
      // Presence is in-memory and real here; the broadcast is recorded so a status
      // change can be checked without a socket server.
      PresenceService,
      { provide: RealtimeService, useValue: { announcePresence: async () => {} } },
      { provide: ConfigService, useValue: { get: (key: string) => ENV[key] } },
    ],
  }).compile();

  return { users: moduleRef.get(UsersService), auth: moduleRef.get(AuthService), prisma, avatars };
}

describe('UsersService', () => {
  let harness: Harness;

  /** Registers the test account and returns its id plus its session id. */
  async function signUp(): Promise<{ userId: string; sessionId: string }> {
    const issued = await harness.auth.register(CREDENTIALS);

    return {
      userId: issued.session.user.id,
      sessionId: issued.refreshToken.split('.')[0] ?? '',
    };
  }

  beforeEach(async () => {
    harness = await buildHarness();
  });

  describe('profiles', () => {
    it('never includes an email in another user’s profile', async () => {
      const { userId } = await signUp();

      const profile = await harness.users.findProfile(userId);

      expect(profile).not.toHaveProperty('email');
      expect(profile.username).toBe('ada');
    });

    it('includes your own email when you read your own account', async () => {
      const { userId } = await signUp();

      await expect(harness.users.findCurrent(userId)).resolves.toMatchObject({
        email: CREDENTIALS.email,
      });
    });

    it('clears a field when it is sent as null and leaves absent fields alone', async () => {
      const { userId } = await signUp();
      await harness.users.updateProfile(userId, { displayName: 'Ada L.', bio: 'Hello' });

      const updated = await harness.users.updateProfile(userId, { bio: null });

      expect(updated.bio).toBeNull();
      expect(updated.displayName).toBe('Ada L.');
    });

    it('rejects a username already taken by someone else', async () => {
      const { userId } = await signUp();
      await harness.auth.register({
        username: 'grace',
        email: 'grace@nestcord.local',
        password: 'password123',
      });

      await expect(harness.users.updateProfile(userId, { username: 'grace' })).rejects.toMatchObject(
        { status: 409 },
      );
    });

    it('allows saving a profile without changing your own username', async () => {
      const { userId } = await signUp();

      await expect(
        harness.users.updateProfile(userId, { username: 'ada', bio: 'Still me' }),
      ).resolves.toMatchObject({ username: 'ada', bio: 'Still me' });
    });
  });

  describe('avatars', () => {
    it('deletes the previous file when a new avatar replaces it', async () => {
      const { userId } = await signUp();
      const file = { buffer: Buffer.from('') } as Express.Multer.File;

      const first = await harness.users.setAvatar(userId, file);
      await harness.users.setAvatar(userId, file);

      expect(harness.avatars.removed).toContain(first.avatarUrl);
    });

    it('deletes the file when the avatar is removed', async () => {
      const { userId } = await signUp();
      const uploaded = await harness.users.setAvatar(userId, {
        buffer: Buffer.from(''),
      } as Express.Multer.File);

      const cleared = await harness.users.removeAvatar(userId);

      expect(cleared.avatarUrl).toBeNull();
      expect(harness.avatars.removed).toContain(uploaded.avatarUrl);
    });
  });

  describe('changePassword', () => {
    it('refuses an incorrect current password', async () => {
      const { userId, sessionId } = await signUp();

      await expect(
        harness.users.changePassword(userId, sessionId, {
          currentPassword: 'not-the-password',
          newPassword: 'a-brand-new-one',
        }),
      ).rejects.toMatchObject({ status: 403 });
    });

    it('refuses a new password identical to the current one', async () => {
      const { userId, sessionId } = await signUp();

      await expect(
        harness.users.changePassword(userId, sessionId, {
          currentPassword: CREDENTIALS.password,
          newPassword: CREDENTIALS.password,
        }),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('stores a new hash that the old password no longer opens', async () => {
      const { userId, sessionId } = await signUp();

      await harness.users.changePassword(userId, sessionId, {
        currentPassword: CREDENTIALS.password,
        newPassword: 'a-brand-new-one',
      });

      await expect(harness.auth.login(CREDENTIALS)).rejects.toMatchObject({ status: 401 });
      await expect(
        harness.auth.login({ email: CREDENTIALS.email, password: 'a-brand-new-one' }),
      ).resolves.toBeTruthy();
    });

    it('signs out every other device but keeps the one making the change', async () => {
      const { userId, sessionId } = await signUp();
      await harness.auth.login(CREDENTIALS);
      await harness.auth.login(CREDENTIALS);

      await harness.users.changePassword(userId, sessionId, {
        currentPassword: CREDENTIALS.password,
        newPassword: 'a-brand-new-one',
      });

      const remaining = await harness.users.listSessions(userId, sessionId);
      expect(remaining).toHaveLength(1);
      expect(remaining[0]?.current).toBe(true);
    });
  });

  describe('sessions', () => {
    it('marks the requesting session as the current one', async () => {
      const { userId, sessionId } = await signUp();
      await harness.auth.login(CREDENTIALS);

      const sessions = await harness.users.listSessions(userId, sessionId);

      expect(sessions).toHaveLength(2);
      expect(sessions.filter((session) => session.current)).toHaveLength(1);
    });

    it('never exposes a refresh token hash', async () => {
      const { userId, sessionId } = await signUp();

      const [session] = await harness.users.listSessions(userId, sessionId);

      expect(session).not.toHaveProperty('refreshTokenHash');
    });

    it('refuses to revoke the session making the request', async () => {
      const { userId, sessionId } = await signUp();

      await expect(
        harness.users.revokeSession(userId, sessionId, sessionId),
      ).rejects.toMatchObject({ status: 400 });
    });

    it('refuses to revoke a session belonging to somebody else', async () => {
      const { userId, sessionId } = await signUp();
      const other = await harness.auth.register({
        username: 'grace',
        email: 'grace@nestcord.local',
        password: 'password123',
      });
      const otherSessionId = other.refreshToken.split('.')[0] ?? '';

      await expect(
        harness.users.revokeSession(userId, otherSessionId, sessionId),
      ).rejects.toMatchObject({ status: 404 });

      // And the other account is still signed in.
      const stillThere = await harness.users.listSessions(other.session.user.id, otherSessionId);
      expect(stillThere).toHaveLength(1);
    });

    it('revokes one other device on request', async () => {
      const { userId, sessionId } = await signUp();
      const second = await harness.auth.login(CREDENTIALS);
      const secondId = second.refreshToken.split('.')[0] ?? '';

      await harness.users.revokeSession(userId, secondId, sessionId);

      await expect(harness.users.listSessions(userId, sessionId)).resolves.toHaveLength(1);
    });
  });
});
