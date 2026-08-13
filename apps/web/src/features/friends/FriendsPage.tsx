import { useState } from 'react';
import { UserPlus } from 'lucide-react';

import type { Friend } from '@nestcord/shared';

import { cn } from '@/lib/utils';
import { AddFriendForm } from './AddFriendForm';
import { FriendRow } from './FriendRow';
import { friendsForTab, incomingCount, useFriends, type FriendTab } from './use-friends';

/** The tabs from PLAN.MD §18, in that order. "Add Friend" is a panel, not a filter. */
const TABS: { value: FriendTab; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'blocked', label: 'Blocked' },
];

const EMPTY_MESSAGES: Record<FriendTab, string> = {
  online: 'None of your friends are online right now.',
  all: 'No friends yet — add someone by their username.',
  pending: 'No requests waiting.',
  blocked: 'You have not blocked anyone.',
};

type Panel = FriendTab | 'add';

/**
 * The friends page: one list, filtered by tab, plus the add form.
 *
 * Everything is driven by the single `useFriends` query, so accepting a request in
 * Pending updates the other tabs without another fetch being wired up per tab.
 */
export function FriendsPage() {
  const [panel, setPanel] = useState<Panel>('online');
  const { data: friends, isPending, isError } = useFriends();

  const waiting = incomingCount(friends ?? []);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="border-border flex h-14 shrink-0 items-center gap-1 border-b px-4">
        <h1 className="font-display mr-3 text-base font-semibold">Friends</h1>

        <nav aria-label="Friends filters" className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              aria-current={panel === tab.value ? 'page' : undefined}
              onClick={() => setPanel(tab.value)}
              className={cn(
                'text-content-300 hover:bg-surface-700 hover:text-content-100 rounded-lg px-2.5 py-1 text-sm transition-colors',
                panel === tab.value && 'bg-surface-600 text-content-100',
              )}
            >
              {tab.label}
              {tab.value === 'pending' && waiting > 0 && (
                <span className="bg-primary text-primary-foreground ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                  {waiting}
                </span>
              )}
            </button>
          ))}

          <button
            type="button"
            aria-current={panel === 'add' ? 'page' : undefined}
            onClick={() => setPanel('add')}
            className={cn(
              'ml-1 flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition-colors',
              panel === 'add'
                ? 'bg-primary text-primary-foreground'
                : 'text-online hover:bg-surface-700',
            )}
          >
            <UserPlus className="size-4" aria-hidden />
            Add Friend
          </button>
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {panel === 'add' ? (
          <AddFriendForm />
        ) : (
          <>
            {isPending && (
              <p role="status" className="text-content-500 text-sm">
                Loading friends…
              </p>
            )}

            {isError && (
              <p role="alert" className="text-destructive text-sm">
                Could not load your friends.
              </p>
            )}

            {friends && <FriendList friends={friends} tab={panel} />}
          </>
        )}
      </div>
    </div>
  );
}

function FriendList({ friends, tab }: { friends: Friend[]; tab: FriendTab }) {
  const shown = friendsForTab(friends, tab);

  if (shown.length === 0) {
    return <p className="text-content-500 text-sm">{EMPTY_MESSAGES[tab]}</p>;
  }

  return (
    <>
      <h2 className="text-content-500 pb-1.5 text-xs font-medium uppercase">
        {tab === 'pending' ? 'Pending' : tab === 'blocked' ? 'Blocked' : 'Friends'} — {shown.length}
      </h2>

      <ul>
        {shown.map((friend) => (
          <FriendRow key={friend.id} friend={friend} />
        ))}
      </ul>
    </>
  );
}
