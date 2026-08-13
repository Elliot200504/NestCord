import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Friend } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { friendsApi } from './api';

/** Which slice of the friends list a tab shows. */
export type FriendTab = 'online' | 'all' | 'pending' | 'blocked';

/**
 * Everyone you have a relationship with, in one request.
 *
 * The list is small — a few hundred entries at the very most — so it is fetched
 * whole and split into tabs on the client rather than one request per tab.
 */
export function useFriends() {
  return useQuery({
    queryKey: keys.friends,
    queryFn: friendsApi.list,
  });
}

export function useSendFriendRequest() {
  return useFriendMutation((username: string) => friendsApi.send(username));
}

export function useAcceptFriendRequest() {
  return useFriendMutation((userId: string) => friendsApi.accept(userId));
}

export function useRemoveFriend() {
  return useFriendMutation((userId: string) => friendsApi.remove(userId));
}

export function useBlockUser() {
  return useFriendMutation((userId: string) => friendsApi.block(userId));
}

export function useUnblockUser() {
  return useFriendMutation((userId: string) => friendsApi.unblock(userId));
}

/**
 * Every friend action re-reads the list rather than patching it.
 *
 * One action can move an entry between three tabs at once — accepting a request
 * empties Pending and fills All — and the list is one cheap request, so letting the
 * server say what the new state is beats reproducing the transitions here.
 */
function useFriendMutation<TInput, TResult>(mutationFn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.friends }),
  });
}

/** The entries one tab should show, in the order the page renders them. */
export function friendsForTab(friends: Friend[], tab: FriendTab): Friend[] {
  if (tab === 'pending') return friends.filter((friend) => friend.status === 'PENDING');
  if (tab === 'blocked') return friends.filter((friend) => friend.status === 'BLOCKED');

  const accepted = friends.filter((friend) => friend.status === 'ACCEPTED');

  return tab === 'online'
    ? accepted.filter((friend) => friend.user.status !== 'OFFLINE')
    : accepted;
}

/** How many people are waiting on you — the count worth putting on a tab. */
export function incomingCount(friends: Friend[]): number {
  return friends.filter((friend) => friend.status === 'PENDING' && friend.direction === 'INCOMING')
    .length;
}
