import { Ban, Check, UserMinus, X } from 'lucide-react';

import type { Friend } from '@nestcord/shared';

import { UserAvatar } from '@/components/UserAvatar';
import { Button } from '@/components/ui/button';
import {
  useAcceptFriendRequest,
  useBlockUser,
  useRemoveFriend,
  useUnblockUser,
} from './use-friends';

/**
 * One person on the friends page, with the actions that make sense for where you
 * stand with them.
 *
 * The row is the only place these actions live, so a pending request offers accept
 * and reject wherever it appears, and a friend never offers "accept".
 */
export function FriendRow({ friend }: { friend: Friend }) {
  const accept = useAcceptFriendRequest();
  const remove = useRemoveFriend();
  const block = useBlockUser();
  const unblock = useUnblockUser();

  const name = friend.user.displayName ?? friend.user.username;
  const isPending = accept.isPending || remove.isPending || block.isPending || unblock.isPending;
  const error = accept.error ?? remove.error ?? block.error ?? unblock.error;

  return (
    <li className="border-border/60 border-b last:border-b-0">
      <div className="hover:bg-surface-700/40 flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition-colors">
        <UserAvatar user={friend.user} size="md" status={friend.user.status} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-content-500 truncate text-xs">{subtitle(friend)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {friend.status === 'PENDING' && friend.direction === 'INCOMING' && (
            <Button
              size="icon-sm"
              variant="secondary"
              aria-label={`Accept ${name}`}
              disabled={isPending}
              onClick={() => accept.mutate(friend.user.id)}
            >
              <Check aria-hidden />
            </Button>
          )}

          {friend.status !== 'BLOCKED' && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`${removeLabel(friend)} ${name}`}
              disabled={isPending}
              onClick={() => remove.mutate(friend.user.id)}
            >
              {friend.status === 'PENDING' ? <X aria-hidden /> : <UserMinus aria-hidden />}
            </Button>
          )}

          {friend.status === 'BLOCKED' ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={isPending}
              onClick={() => unblock.mutate(friend.user.id)}
            >
              Unblock
            </Button>
          ) : (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Block ${name}`}
              disabled={isPending}
              onClick={() => block.mutate(friend.user.id)}
            >
              <Ban aria-hidden />
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p role="alert" className="text-destructive px-2.5 pb-2 text-xs">
          {error.message}
        </p>
      )}
    </li>
  );
}

/** The one line under a name: what this relationship currently is. */
function subtitle(friend: Friend): string {
  if (friend.status === 'BLOCKED') return 'Blocked';

  if (friend.status === 'PENDING') {
    return friend.direction === 'INCOMING' ? 'Wants to be friends' : 'Request sent';
  }

  return friend.user.status === 'OFFLINE' ? 'Offline' : 'Online';
}

/** Rejecting, withdrawing and unfriending are one route but three different words. */
function removeLabel(friend: Friend): string {
  if (friend.status !== 'PENDING') return 'Remove';

  return friend.direction === 'INCOMING' ? 'Reject request from' : 'Withdraw request to';
}
