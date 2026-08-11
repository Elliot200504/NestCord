import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import type { AuthSession, PublicUser } from '@nestcord/shared';

import { setAccessToken } from '@/api/client';
import { keys } from '@/api/keys';
import { authApi, type LoginInput, type RegisterInput } from './api';

/**
 * The signed-in user. Only meaningful under the `/app` guard, which has already
 * established a session by the time any component renders.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: keys.me,
    queryFn: authApi.me,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useLogin(redirectTo: string) {
  return useAuthMutation(authApi.login, redirectTo);
}

export function useRegister(redirectTo: string) {
  return useAuthMutation(authApi.register, redirectTo);
}

/** Login and registration differ only in their payload, so they share this. */
function useAuthMutation<TInput extends LoginInput | RegisterInput>(
  mutationFn: (input: TInput) => Promise<AuthSession>,
  redirectTo: string,
) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn,
    onSuccess: async (session) => {
      setAccessToken(session.accessToken);
      // Seeding the cache saves an immediate /auth/me round trip.
      queryClient.setQueryData<PublicUser>(keys.me, session.user);
      await navigate({ to: redirectTo });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: authApi.logout,
    // Runs on failure too: if the server already dropped the session, the client
    // must still forget it rather than sit in a half-signed-in state.
    onSettled: async () => {
      setAccessToken(null);
      queryClient.clear();
      await navigate({ to: '/login' });
    },
  });
}
