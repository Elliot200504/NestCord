import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setAccessToken } from '@/api/client';
import { routeTree } from '@/router';

const USER = {
  id: 'user-1',
  username: 'ada',
  displayName: 'Ada L.',
  avatarUrl: null,
  accentColor: '#e0234e',
  status: 'ONLINE',
  bio: 'Writing the notes nobody asked for.',
  email: 'ada@nestcord.local',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const SESSIONS = [
  {
    id: 'session-1',
    userAgent: 'Mozilla/5.0 (Macintosh) Chrome/120',
    createdAt: '2026-08-01T09:00:00.000Z',
    expiresAt: '2026-09-01T09:00:00.000Z',
    current: true,
  },
  {
    id: 'session-2',
    userAgent: 'Mozilla/5.0 (iPhone) Safari/17',
    createdAt: '2026-08-02T09:00:00.000Z',
    expiresAt: '2026-09-02T09:00:00.000Z',
    current: false,
  },
];

type Handler = (init?: RequestInit) => Response;

function stubApi(overrides: Record<string, Handler> = {}) {
  const handlers: Record<string, Handler> = {
    '/api/users/me': () => json(USER),
    '/api/users/me/sessions': () => json(SESSIONS),
    ...overrides,
  };

  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const handler = handlers[String(input)];
    return Promise.resolve(handler ? handler(init) : json({ message: 'Not found' }, 404));
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

  return router;
}

describe('settings', () => {
  beforeEach(() => {
    // A token in module scope stands in for having logged in.
    setAccessToken('access-token');
  });

  afterEach(() => {
    setAccessToken(null);
    vi.unstubAllGlobals();
  });

  it('sends only the profile fields, with emptied ones cleared', async () => {
    const fetchMock = stubApi({
      '/api/users/me': (init) =>
        init?.method === 'PATCH' ? json({ ...USER, bio: null }) : json(USER),
    });
    const user = userEvent.setup();
    await renderAt('/settings/profile');

    const bio = await screen.findByLabelText('About me');
    await user.clear(bio);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH');
      expect(JSON.parse(String(patch?.[1]?.body))).toEqual({
        username: 'ada',
        displayName: 'Ada L.',
        bio: null,
        accentColor: '#e0234e',
      });
    });
  });

  it('keeps the save button disabled until something actually changes', async () => {
    stubApi();
    const user = userEvent.setup();
    await renderAt('/settings/profile');

    const save = await screen.findByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText('Display name'), '!');
    expect(save).toBeEnabled();
  });

  it('shows the server error when a username is taken', async () => {
    stubApi({
      '/api/users/me': (init) =>
        init?.method === 'PATCH'
          ? json({ message: 'That username is already taken' }, 409)
          : json(USER),
    });
    const user = userEvent.setup();
    await renderAt('/settings/profile');

    await user.type(await screen.findByLabelText('Username'), 'x');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('That username is already taken');
  });

  it('refuses to submit a password change when the confirmation does not match', async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup();
    await renderAt('/settings/account');

    await user.type(await screen.findByLabelText('Current password'), 'password123');
    await user.type(screen.getByLabelText('New password'), 'a-brand-new-one');
    await user.type(screen.getByLabelText('Confirm new password'), 'a-different-one');
    await user.click(screen.getByRole('button', { name: 'Change password' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('do not match');
    expect(fetchMock.mock.calls.some(([path]) => String(path).includes('password'))).toBe(false);
  });

  it('lists signed-in devices and marks the current one', async () => {
    stubApi();
    await renderAt('/settings/account');

    expect(await screen.findByText('Chrome on Macintosh')).toBeInTheDocument();
    expect(screen.getByText('Safari on iPhone')).toBeInTheDocument();
    expect(screen.getByText('This device')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Sign out all other devices (1)' }),
    ).toBeInTheDocument();
  });

  it('never offers to sign out the device you are using', async () => {
    stubApi();
    await renderAt('/settings/account');

    await screen.findByText('Chrome on Macintosh');
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('opens the account section when /settings is visited directly', async () => {
    stubApi();
    const router = await renderAt('/settings');

    await waitFor(() => expect(router.state.location.pathname).toBe('/settings/account'));
  });
});
