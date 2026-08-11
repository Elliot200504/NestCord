import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { CurrentUser, PresenceStatus } from '@nestcord/shared';

import { keys } from '@/api/keys';
import { usersApi, type ChangePasswordInput, type UpdateProfileInput } from './api';

/** Another member's profile card. Only fetched when a card is actually opened. */
export function useProfile(userId: string | null) {
  return useQuery({
    queryKey: keys.profile(userId ?? ''),
    queryFn: () => usersApi.profile(userId ?? ''),
    enabled: userId !== null,
  });
}

export function useUpdateProfile() {
  return useCurrentUserMutation((input: UpdateProfileInput) => usersApi.updateProfile(input));
}

export function useUpdateStatus() {
  return useCurrentUserMutation((status: PresenceStatus) => usersApi.updateStatus(status));
}

export function useUploadAvatar() {
  return useCurrentUserMutation((file: File) => usersApi.uploadAvatar(file));
}

export function useRemoveAvatar() {
  return useCurrentUserMutation(() => usersApi.removeAvatar());
}

/**
 * Every profile mutation answers with the updated user, so the cache can be set
 * from the response instead of triggering another round trip.
 */
function useCurrentUserMutation<TInput>(mutationFn: (input: TInput) => Promise<CurrentUser>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (user) => queryClient.setQueryData<CurrentUser>(keys.me, user),
  });
}

/** The devices signed in to this account. */
export function useSessions() {
  return useQuery({ queryKey: keys.sessions, queryFn: usersApi.sessions });
}

export function useRevokeSession() {
  return useSessionMutation((sessionId: string) => usersApi.revokeSession(sessionId));
}

export function useRevokeOtherSessions() {
  return useSessionMutation(() => usersApi.revokeOtherSessions());
}

function useSessionMutation<TInput>(mutationFn: (input: TInput) => Promise<void>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}

/**
 * Changing a password ends every other session, so the list of devices is stale
 * the moment it succeeds.
 */
export function useChangePassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangePasswordInput) => usersApi.changePassword(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.sessions }),
  });
}
