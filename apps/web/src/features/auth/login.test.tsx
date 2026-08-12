import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAccessToken } from '@/api/client';
import { DEFAULT_APP_PATH } from '@/features/auth/require-auth';
import { routeTree } from '@/router';

const USER = {
  id: 'user-1',
  username: 'ada',
  displayName: null,
  avatarUrl: null,
  accentColor: null,
  status: 'ONLINE',
};

/** Answers the endpoints the login flow touches; everything else is a 404. */
function stubApi(overrides: Record<string, () => Response> = {}) {
  const handlers: Record<string, () => Response> = {
    '/api/auth/login': () => json({ accessToken: 'access-token', user: USER }),
    '/api/auth/refresh': () => json({ message: 'Missing refresh token' }, 401),
    '/api/users/me': () => json({ ...USER, bio: null, createdAt: '2026-01-01T00:00:00.000Z' }),
    ...overrides,
  };

  const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
    const path = String(input);
    const handler = handlers[path];
    return Promise.resolve(handler ? handler() : json({ message: 'Not found' }, 404));
  });

  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function renderAt(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      {/* The router type is registered for the app's own instance, not this one. */}
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  );

  await waitFor(() => expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument());

  return router;
}

describe('login flow', () => {
  beforeEach(() => {
    // The access token lives in a module, so it has to be cleared between tests.
    setAccessToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the credentials and lands the visitor in the app', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    const router = await renderAt('/login');

    await user.type(screen.getByLabelText('Email'), 'ada@nestcord.local');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEFAULT_APP_PATH));

    const call = fetchMock.mock.calls.find(([path]) => path === '/api/auth/login');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      email: 'ada@nestcord.local',
      password: 'password123',
    });
  });

  it('shows the server error and stays put when the password is wrong', async () => {
    stubApi({
      '/api/auth/login': () => json({ message: 'Incorrect email or password' }, 401),
    });
    const user = userEvent.setup();
    const router = await renderAt('/login');

    await user.type(screen.getByLabelText('Email'), 'ada@nestcord.local');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password');
    expect(router.state.location.pathname).toBe('/login');
  });

  it('sends an unauthenticated visitor from /app to the login page', async () => {
    stubApi();
    const router = await renderAt(DEFAULT_APP_PATH);

    expect(router.state.location.pathname).toBe('/login');
    expect(router.state.location.search).toEqual({ redirect: DEFAULT_APP_PATH });
  });

  it('returns the visitor to where they were headed after logging in', async () => {
    stubApi();
    const user = userEvent.setup();
    const router = await renderAt('/login?redirect=%2Fapp%2Fdesign%2Fideas');

    await user.type(screen.getByLabelText('Email'), 'ada@nestcord.local');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/design/ideas'));
  });

  it('ignores an off-site redirect target rather than following it', async () => {
    stubApi();
    const user = userEvent.setup();
    const router = await renderAt('/login?redirect=https%3A%2F%2Fevil.example');

    await user.type(screen.getByLabelText('Email'), 'ada@nestcord.local');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    await waitFor(() => expect(router.state.location.pathname).toBe(DEFAULT_APP_PATH));
  });
});
