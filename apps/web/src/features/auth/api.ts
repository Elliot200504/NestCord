import type { AuthSession } from '@nestcord/shared';

import { apiRequest } from '@/api/client';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  username: string;
}

export const authApi = {
  register: (input: RegisterInput) =>
    apiRequest<AuthSession>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
      retryOnUnauthorized: false,
    }),

  login: (input: LoginInput) =>
    apiRequest<AuthSession>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
      retryOnUnauthorized: false,
    }),

  // The signed-in user is read through `usersApi.me`, which returns the full
  // profile. `/auth/me` stays on the server as the guard's own probe.
  logout: () => apiRequest<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),
};
