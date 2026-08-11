import type { PresenceStatus, PublicUser } from '@nestcord/shared';

import { avatarTint } from '@/lib/avatar-tint';
import { cn } from '@/lib/utils';
import { PresenceDot } from './PresenceDot';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<AvatarSize, string> = {
  sm: 'size-6 text-[0.6rem]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-20 text-2xl',
};

/** Nudges the dot inward on the big sizes so it sits on the circle, not off it. */
const DOT_POSITION: Record<AvatarSize, string> = {
  sm: '-right-0.5 -bottom-0.5',
  md: '-right-0.5 -bottom-0.5',
  lg: 'right-0 bottom-0',
  xl: 'right-1 bottom-1',
};

const DOT_SIZE: Record<AvatarSize, string> = {
  sm: 'size-2.5',
  md: 'size-3',
  lg: 'size-3.5',
  xl: 'size-5 border-4',
};

interface UserAvatarProps {
  /** Anything user-shaped: the member list, the profile card and the panel all fit. */
  user: Pick<PublicUser, 'username' | 'displayName' | 'avatarUrl' | 'accentColor'>;
  size?: AvatarSize;
  /** Pass a status to show the presence dot; omit it for a plain avatar. */
  status?: PresenceStatus;
  className?: string;
}

/**
 * One avatar for the whole app: the uploaded image when there is one, otherwise
 * initials on a stable tint. The accent colour becomes a ring, which is what
 * makes a wall of avatars scannable.
 */
export function UserAvatar({ user, size = 'md', status, className }: UserAvatarProps) {
  const name = user.displayName ?? user.username;

  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          className={cn('rounded-full object-cover', SIZES[size])}
          style={ringStyle(user.accentColor)}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            'grid place-items-center rounded-full font-semibold uppercase',
            SIZES[size],
            avatarTint(user.username),
          )}
          style={ringStyle(user.accentColor)}
        >
          {initials(name)}
        </span>
      )}

      {status && (
        <PresenceDot
          status={status}
          className={cn('absolute', DOT_POSITION[size], DOT_SIZE[size])}
        />
      )}
    </span>
  );
}

/** Drawn outside the circle so it never eats into the image. */
function ringStyle(accentColor: string | null): React.CSSProperties | undefined {
  if (!accentColor) return undefined;

  return { boxShadow: `0 0 0 2px var(--color-surface-800), 0 0 0 3.5px ${accentColor}` };
}

function initials(name: string): string {
  return name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 2) || '?';
}
