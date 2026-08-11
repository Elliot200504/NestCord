import type { AuthSession, PublicUser } from '@nestcord/shared';

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

  logout: () =>
    apiRequest<void>('/auth/logout', { method: 'POST', retryOnUnauthorized: false }),

  me: () => apiRequest<PublicUser>('/auth/me'),
};
