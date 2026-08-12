import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import type {
  CurrentUser,
  PresenceStatus,
  PublicUser,
  UserProfile,
  UserSession,
} from '@nestcord/shared';

import { hashPassword, verifyPassword } from '../auth/password';
import { PUBLIC_USER_SELECT, toPublicUser } from '../auth/public-user';
import { PrismaService } from '../common/prisma/prisma.service';
// A value import, not `import type`: the decorator metadata Nest injects from
// only exists if the class survives compilation.
import { AvatarStorage } from './avatar.storage';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

const PROFILE_SELECT = { ...PUBLIC_USER_SELECT, bio: true, createdAt: true } as const;
const CURRENT_USER_SELECT = { ...PROFILE_SELECT, email: true } as const;

/** What Prisma hands back — dates are still dates here, not ISO strings. */
interface ProfileRow extends PublicUser {
  bio: string | null;
  createdAt: Date;
}

interface CurrentUserRow extends ProfileRow {
  email: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly avatars: AvatarStorage,
  ) {}

  /** Anyone signed in may look at anyone's profile card — but never their email. */
  async findProfile(userId: string): Promise<UserProfile> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });

    if (!user) throw new NotFoundException('No such user');

    return toProfile(user);
  }

  async findCurrent(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: CURRENT_USER_SELECT,
    });

    if (!user) throw new NotFoundException('No such user');

    return toCurrentUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<CurrentUser> {
    if (dto.username) await this.assertUsernameFree(userId, dto.username);

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      // Only the keys the request actually sent, so an absent field is left alone
      // while an explicit null clears it.
      data: {
        ...(dto.username === undefined ? {} : { username: dto.username }),
        ...(dto.displayName === undefined ? {} : { displayName: dto.displayName }),
        ...(dto.bio === undefined ? {} : { bio: dto.bio }),
        ...(dto.accentColor === undefined ? {} : { accentColor: dto.accentColor }),
      },
      select: CURRENT_USER_SELECT,
    });

    return toCurrentUser(user);
  }

  async updateStatus(userId: string, status: PresenceStatus): Promise<CurrentUser> {
    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { status },
      select: CURRENT_USER_SELECT,
    });

    return toCurrentUser(user);
  }

  /**
   * Changing a password ends every other session. If the old password leaked,
   * changing it has to actually push the other party out.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!user) throw new NotFoundException('No such user');

    if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
      throw new ForbiddenException('Your current password is not correct');
    }

    if (dto.newPassword === dto.currentPassword) {
      throw new BadRequestException('The new password must differ from the current one');
    }

    await this.prisma.client.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(dto.newPassword) },
    });

    await this.revokeOtherSessions(userId, currentSessionId);
  }

  /** Stores the uploaded file and points the user at it, discarding the old one. */
  async setAvatar(userId: string, file: Express.Multer.File): Promise<CurrentUser> {
    const previous = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const avatarUrl = await this.avatars.save(file);

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: CURRENT_USER_SELECT,
    });

    await this.avatars.remove(previous?.avatarUrl ?? null);

    return toCurrentUser(user);
  }

  async removeAvatar(userId: string): Promise<CurrentUser> {
    const previous = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    const user = await this.prisma.client.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: CURRENT_USER_SELECT,
    });

    // Only once the row has stopped pointing at the file is it safe to delete.
    await this.avatars.remove(previous?.avatarUrl ?? null);

    return toCurrentUser(user);
  }

  async listSessions(userId: string, currentSessionId: string): Promise<UserSession[]> {
    const sessions = await this.prisma.client.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, userAgent: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return sessions.map((session) => ({
      id: session.id,
      userAgent: session.userAgent,
      createdAt: session.createdAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      current: session.id === currentSessionId,
    }));
  }

  /**
   * Scoped by `userId` as well as id: without that, knowing a session id would be
   * enough to sign anyone out.
   */
  async revokeSession(userId: string, sessionId: string, currentSessionId: string): Promise<void> {
    if (sessionId === currentSessionId) {
      throw new BadRequestException('Use logout to end the session you are using');
    }

    const { count } = await this.prisma.client.session.deleteMany({
      where: { id: sessionId, userId },
    });

    if (count === 0) throw new NotFoundException('No such session');
  }

  async revokeOtherSessions(userId: string, currentSessionId: string): Promise<number> {
    const { count } = await this.prisma.client.session.deleteMany({
      where: { userId, id: { not: currentSessionId } },
    });

    return count;
  }

  private async assertUsernameFree(userId: string, username: string): Promise<void> {
    const taken = await this.prisma.client.user.findFirst({
      where: { username, id: { not: userId } },
      select: { id: true },
    });

    if (taken) throw new ConflictException('That username is already taken');
  }
}

function toProfile(user: ProfileRow): UserProfile {
  return { ...toPublicUser(user), bio: user.bio, createdAt: user.createdAt.toISOString() };
}

function toCurrentUser(user: CurrentUserRow): CurrentUser {
  return { ...toProfile(user), email: user.email };
}
